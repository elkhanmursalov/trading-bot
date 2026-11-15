"""Account view for the widget: open orders, executions and position, refreshed and pushed to listeners."""

import asyncio
import logging
import time
from decimal import Decimal

from binance.client import Client

from .config import ACCOUNT_POLL_SECONDS, HISTORY_DAYS_DEFAULT
from .exchange import SymbolRules, fetch_my_trades, fetch_open_orders
from .schemas import AccountSnapshot, Execution, OpenOrder, Position

log = logging.getLogger(__name__)

DAY_MS = 24 * 60 * 60 * 1000


def now_ms() -> int:
    return int(time.time() * 1000)


def to_open_order(raw: dict) -> OpenOrder:
    """API order dict -> OpenOrder."""
    return OpenOrder(order_id=raw["orderId"], time=raw["time"], side=raw["side"], type=raw["type"],
                     price=float(raw["price"]), quantity=float(raw["origQty"]),
                     filled=float(raw["executedQty"]), status=raw["status"])


def group_fills_by_order(fills: list[dict]) -> list[Execution]:
    """Combine the fills of each order into one Execution, oldest first."""
    orders: dict[int, list[dict]] = {}
    for fill in fills:
        orders.setdefault(fill["orderId"], []).append(fill)

    executions = []
    for order_id, order_fills in orders.items():
        quantity = sum(Decimal(f["qty"]) for f in order_fills)          # exact sums: Binance sends
        amount = sum(Decimal(f["quoteQty"]) for f in order_fills)       # decimal text, floats would drift
        executions.append(Execution(
            order_id=order_id,
            time=min(f["time"] for f in order_fills),
            side="BUY" if order_fills[0]["isBuyer"] else "SELL",
            price=float(amount / quantity),
            quantity=float(quantity),
            amount=float(amount),
            fee=float(sum(Decimal(f["commission"]) for f in order_fills)),
            fee_asset=order_fills[0]["commissionAsset"],
        ))
    return sorted(executions, key=lambda e: e.time)


def position_from_executions(executions: list[Execution], rules: SymbolRules) -> Position:
    """The bot holds the last order's quantity (minus a fee paid in the base asset) if that order was a buy."""
    last = executions[-1] if executions else None
    if last is None or last.side != "BUY":
        return Position(symbol=rules.symbol, in_position=False, quantity=0.0, entry_price=None, entry_time=None)
    fee_in_base = Decimal(str(last.fee)) if last.fee_asset == rules.base_asset else Decimal(0)
    return Position(symbol=rules.symbol, in_position=True, quantity=float(Decimal(str(last.quantity)) - fee_in_base),
                    entry_price=last.price, entry_time=last.time)


def executions_since(executions: list[Execution], days: int) -> list[Execution]:
    """Executions of the last `days` days, newest first (as shown in the history tab)."""
    cutoff = now_ms() - days * DAY_MS
    return [e for e in reversed(executions) if e.time >= cutoff]


class AccountService:
    """Keeps the latest account snapshot and pushes it to stream listeners when it changes."""

    def __init__(self, client: Client, rules: SymbolRules) -> None:
        self._client = client
        self._rules = rules
        self._lock = asyncio.Lock()
        self._snapshot: AccountSnapshot | None = None
        self._executions: list[Execution] = []      # all known executions, oldest first
        self._listeners: set[asyncio.Queue[AccountSnapshot]] = set()

    def _fetch(self) -> tuple[list[dict], list[dict]]:
        """Blocking Binance calls (run in a worker thread)."""
        return (fetch_open_orders(self._client, self._rules.symbol),
                fetch_my_trades(self._client, self._rules.symbol))

    async def refresh(self) -> AccountSnapshot:
        """Load fresh data from Binance; notify listeners if anything changed."""
        async with self._lock:
            raw_orders, fills = await asyncio.to_thread(self._fetch)
            executions = group_fills_by_order(fills)
            snapshot = AccountSnapshot(
                symbol=self._rules.symbol,
                position=position_from_executions(executions, self._rules),
                open_orders=sorted((to_open_order(o) for o in raw_orders), key=lambda o: o.time, reverse=True),
                executions=executions_since(executions, HISTORY_DAYS_DEFAULT),
                updated_at=now_ms(),
            )
            changed = (self._snapshot is None
                       or snapshot.model_dump(exclude={"updated_at"}) != self._snapshot.model_dump(exclude={"updated_at"}))
            self._snapshot, self._executions = snapshot, executions
        if changed:
            self._notify(snapshot)
        return snapshot

    async def current(self) -> AccountSnapshot:
        """Latest snapshot; refreshed first if older than the poll interval."""
        snapshot = self._snapshot
        if snapshot is None or now_ms() - snapshot.updated_at > ACCOUNT_POLL_SECONDS * 1000:
            snapshot = await self.refresh()
        return snapshot

    async def executions(self, days: int) -> list[Execution]:
        """Executions of the last `days` days, newest first."""
        await self.current()
        return executions_since(self._executions, days)

    def subscribe(self) -> asyncio.Queue[AccountSnapshot]:
        """New listener; it always receives the newest snapshot (older unread ones are dropped)."""
        queue: asyncio.Queue[AccountSnapshot] = asyncio.Queue(maxsize=1)
        self._listeners.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[AccountSnapshot]) -> None:
        self._listeners.discard(queue)

    def _notify(self, snapshot: AccountSnapshot) -> None:
        for queue in self._listeners:
            if queue.full():
                queue.get_nowait()
            queue.put_nowait(snapshot)

    async def poll_forever(self) -> None:
        """Refresh every ACCOUNT_POLL_SECONDS while someone is listening."""
        while True:
            if self._listeners:
                try:
                    await self.refresh()
                except Exception as error:   # keep polling; the next round may succeed
                    log.warning("Account refresh failed: %s", error)
            await asyncio.sleep(ACCOUNT_POLL_SECONDS)
