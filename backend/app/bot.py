"""The SMA crossover bot: checks after every candle close and trades on a crossing."""

import asyncio
import logging

import pandas as pd
from binance.client import Client

from .account import AccountService, now_ms
from .config import CHECK_DELAY_SECONDS, INTERVAL, MAX_SLEEP_STEP_SECONDS, TRADE_SIZE_USDT
from .events import EventHub
from .exchange import SymbolRules, place_market_buy, place_market_sell
from .schemas import BotStatus
from .strategy import BUY, FAST_COLUMN, SELL, SLOW_COLUMN, latest_closed_candle

log = logging.getLogger(__name__)


def format_amount(value: float) -> str:
    """Number with up to 8 decimals and no trailing zeros (small BTC amounts stay visible)."""
    return f"{value:,.8f}".rstrip("0").rstrip(".")


def next_check_time(interval: str) -> pd.Timestamp:
    """Next candle close plus CHECK_DELAY_SECONDS, in UTC."""
    now = pd.Timestamp.now(tz="UTC")
    step = pd.Timedelta(interval)
    return now.floor(step) + step + pd.Timedelta(seconds=CHECK_DELAY_SECONDS)


async def sleep_until(target: pd.Timestamp) -> None:
    """Wait for a wall-clock time in short steps, so a paused machine catches up when it wakes."""
    while (remaining := (target - pd.Timestamp.now(tz="UTC")).total_seconds()) > 0:
        await asyncio.sleep(min(remaining, MAX_SLEEP_STEP_SECONDS))


class Bot:
    """Runs the strategy on the closed candles and places testnet orders (or only reports them in dry run)."""

    def __init__(self, client: Client, rules: SymbolRules, account: AccountService, mode: str,
                 hub: EventHub) -> None:
        self._client = client
        self._rules = rules
        self._account = account
        self._hub = hub
        self.status = BotStatus(mode=mode, symbol=rules.symbol, interval=INTERVAL,
                                last_check=None, last_message=None, last_error=None, next_check=None)

    def _publish_status(self) -> None:
        """Send the current bot status to the stream."""
        self._hub.publish("bot", self.status.model_dump_json())

    def _describe(self, side: str, quantity: float, amount: float) -> str:
        return f"{side} {format_amount(quantity)} {self._rules.base_asset} for {amount:,.2f} {self._rules.quote_asset}"

    async def _buy(self, close: float) -> str:
        if self.status.mode == "dry_run":
            return "would " + self._describe("BUY", TRADE_SIZE_USDT / close, TRADE_SIZE_USDT)
        order = await asyncio.to_thread(place_market_buy, self._client, self._rules.symbol, TRADE_SIZE_USDT)
        return self._describe("BUY", float(order["executedQty"]), float(order["cummulativeQuoteQty"]))

    async def _sell(self, quantity: float, close: float) -> str:
        if self.status.mode == "dry_run":
            return "would " + self._describe("SELL", quantity, quantity * close)
        order = await asyncio.to_thread(place_market_sell, self._client, self._rules, quantity)
        return self._describe("SELL", float(order["executedQty"]), float(order["cummulativeQuoteQty"]))

    async def run_cycle(self) -> str:
        """One check: latest signal, an order if the rules call for one, and a status line."""
        candle = await asyncio.to_thread(latest_closed_candle, self._rules.symbol, INTERVAL)
        position = (await self._account.refresh()).position
        held = position.quantity if position.in_position else 0.0
        signal, close = candle["Signal"], float(candle["Close Price"])

        if signal == BUY and held == 0:
            action = await self._buy(close)
        elif signal == SELL and held > 0:
            action = await self._sell(held, close)
        else:
            action = f"no order ({f'holding {format_amount(held)} {self._rules.base_asset}' if held else 'no position'})"

        if not action.startswith(("no order", "would")):
            await self._account.refresh()   # push the new order to the widget right away
        return (f"candle {candle.name:%Y-%m-%d %H:%M} | close {close:,.2f} | "
                f"fast {candle[FAST_COLUMN]:,.2f} | slow {candle[SLOW_COLUMN]:,.2f} | "
                f"trend {candle['Trend'] or '-'} | signal {signal or '-'} | {action}")

    async def run_forever(self) -> None:
        """Check once now, then after every candle close. Errors are reported and retried at the next check."""
        log.info("Bot started | mode %s | %s %s", self.status.mode, self._rules.symbol, INTERVAL)
        while True:
            try:
                message = await self.run_cycle()
                self.status.last_message, self.status.last_error = message, None
                log.info(message)
            except Exception as error:   # network or Binance error: try again at the next check
                self.status.last_error = str(error)
                log.warning("Bot check failed, retrying at the next check: %s", error)
            self.status.last_check = now_ms()
            target = next_check_time(INTERVAL)
            self.status.next_check = int(target.timestamp() * 1000)
            self._publish_status()
            await sleep_until(target)
