"""Response shapes of the API (also shown at /docs). Times are milliseconds since epoch (UTC)."""

from typing import Literal

from pydantic import BaseModel

Side = Literal["BUY", "SELL"]


class OpenOrder(BaseModel):
    """An order on the book that has not fully filled yet."""
    order_id: int
    time: int
    side: Side
    type: str
    price: float
    quantity: float
    filled: float
    status: str


class Execution(BaseModel):
    """One filled order; its fills are combined into a single row."""
    order_id: int
    time: int
    side: Side
    price: float          # average fill price
    quantity: float       # base asset (BTC)
    amount: float         # quote asset (USDT)
    fee: float
    fee_asset: str


class Position(BaseModel):
    """What the bot holds: the last order if it was a buy, else nothing."""
    symbol: str
    in_position: bool
    quantity: float
    entry_price: float | None
    entry_time: int | None


class AccountSnapshot(BaseModel):
    """Everything the widget's panel and chart overlays need, sent as one object."""
    symbol: str
    position: Position
    open_orders: list[OpenOrder]
    executions: list[Execution]
    updated_at: int


class BotStatus(BaseModel):
    """What the bot did last and when it checks next."""
    mode: str
    symbol: str
    interval: str
    last_check: int | None
    last_message: str | None
    last_error: str | None
    next_check: int | None
