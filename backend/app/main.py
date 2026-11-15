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
from .events import EventHub
from .exchange import connect_testnet, get_symbol_rules
from .schemas import BotStatus, Execution, OpenOrder, Position

KEEP_ALIVE_SECONDS = 15   # comment line on idle streams so proxies do not close them

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s | %(message)s")
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Connect to the testnet, start the account poller and (unless BOT_MODE=off) the bot."""
    client = await asyncio.to_thread(connect_testnet)
    rules = await asyncio.to_thread(get_symbol_rules, client, SYMBOL)
    hub = EventHub()
    account = AccountService(client, rules, hub)
    bot = Bot(client, rules, account, BOT_MODE, hub)
    app.state.account, app.state.bot, app.state.hub = account, bot, hub

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


def sse_message(event: str, data: str) -> str:
    """One Server-Sent Events message: the event name and a JSON payload."""
    return f"event: {event}\ndata: {data}\n\n"


@app.get("/api/stream")
async def stream(request: Request) -> StreamingResponse:
    """Server-Sent Events. Event `account`: the account snapshot. Event `bot`: the bot status.
    Both are sent once on connect, then again whenever they change."""
    account, hub = account_of(request), request.app.state.hub
    subscriber = hub.subscribe()   # subscribe first, so nothing published during the first reads is lost

    async def events() -> AsyncIterator[str]:
        try:
            yield sse_message("account", (await account.current()).model_dump_json())
            yield sse_message("bot", request.app.state.bot.status.model_dump_json())
            while not await request.is_disconnected():
                try:
                    batch = await subscriber.next_batch(KEEP_ALIVE_SECONDS)
                except TimeoutError:
                    yield ": keep-alive\n\n"
                    continue
                for event, data in batch.items():
                    yield sse_message(event, data)
        finally:
            hub.unsubscribe(subscriber)

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
