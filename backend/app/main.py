"""FastAPI app: read-only account data for the widget, a live stream, and the bot as a background task.

Run locally from backend/:  .venv/bin/uvicorn app.main:app --reload
"""

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import requests
from binance.exceptions import BinanceAPIException, BinanceRequestException
from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from .account import AccountService
from .bot import Bot
from .config import BOT_MODE, CORS_ORIGINS, HISTORY_DAYS_DEFAULT, HISTORY_DAYS_MAX, SYMBOL
from .exchange import connect_testnet, get_symbol_rules
from .schemas import AccountSnapshot, BotStatus, Execution, OpenOrder, Position

KEEP_ALIVE_SECONDS = 15   # comment line on idle streams so proxies do not close them

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s | %(message)s")
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Connect to the testnet, start the account poller and (unless BOT_MODE=off) the bot."""
    client = await asyncio.to_thread(connect_testnet)
    rules = await asyncio.to_thread(get_symbol_rules, client, SYMBOL)
    account = AccountService(client, rules)
    bot = Bot(client, rules, account, BOT_MODE)
    app.state.account, app.state.bot = account, bot

    tasks = [asyncio.create_task(account.poll_forever())]
    if BOT_MODE != "off":
        tasks.append(asyncio.create_task(bot.run_forever()))
    log.info("Backend ready | %s | bot mode %s | CORS %s", SYMBOL, BOT_MODE, CORS_ORIGINS)
    yield
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)


app = FastAPI(title="Trading bot API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["GET"], allow_headers=["*"])


@app.exception_handler(BinanceAPIException)
@app.exception_handler(BinanceRequestException)
@app.exception_handler(requests.RequestException)
async def binance_error(_: Request, error: Exception) -> JSONResponse:
    """Binance unreachable or refused the call: 502 instead of a crash."""
    return JSONResponse(status_code=502, content={"detail": f"Binance request failed: {error}"})


def account_of(request: Request) -> AccountService:
    return request.app.state.account


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/api/position", response_model=Position)
async def position(request: Request) -> Position:
    return (await account_of(request).current()).position


@app.get("/api/open-orders", response_model=list[OpenOrder])
async def open_orders(request: Request) -> list[OpenOrder]:
    return (await account_of(request).current()).open_orders


@app.get("/api/trades", response_model=list[Execution])
async def trades(request: Request,
                 days: int = Query(HISTORY_DAYS_DEFAULT, ge=1, le=HISTORY_DAYS_MAX)) -> list[Execution]:
    """Filled orders of the last `days` days, newest first."""
    return await account_of(request).executions(days)


@app.get("/api/bot", response_model=BotStatus)
async def bot_status(request: Request) -> BotStatus:
    return request.app.state.bot.status


def sse_event(snapshot: AccountSnapshot) -> str:
    return f"event: account\ndata: {snapshot.model_dump_json()}\n\n"


@app.get("/api/stream")
async def stream(request: Request) -> StreamingResponse:
    """Server-Sent Events: the full account snapshot now, then again whenever it changes."""
    account = account_of(request)
    queue = account.subscribe()

    async def events() -> AsyncIterator[str]:
        try:
            yield sse_event(await account.current())
            while not await request.is_disconnected():
                try:
                    yield sse_event(await asyncio.wait_for(queue.get(), timeout=KEEP_ALIVE_SECONDS))
                except TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            account.unsubscribe(queue)

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
