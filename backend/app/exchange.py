"""Binance Spot Testnet: connection, symbol rules, orders and account data (signed calls)."""

import os
from dataclasses import dataclass
from decimal import ROUND_DOWN, Decimal

from binance.client import Client

from .config import TESTNET_KEY_NAMES

MY_TRADES_LIMIT = 1000   # most recent fills per request (Binance maximum)


@dataclass(frozen=True)
class SymbolRules:
    """Facts about the traded symbol that orders and position math depend on."""
    symbol: str
    base_asset: str      # BTC
    quote_asset: str     # USDT
    lot_step: Decimal    # smallest quantity step Binance accepts (LOT_SIZE filter)


def connect_testnet() -> Client:
    """Client for Binance Spot Testnet, using the testnet keys from the environment."""
    api_key, secret_key = (os.getenv(name) for name in TESTNET_KEY_NAMES)
    if not api_key or not secret_key:
        raise RuntimeError(f"Missing environment variables: {', '.join(TESTNET_KEY_NAMES)}")
    return Client(api_key, secret_key, testnet=True)


def get_symbol_rules(client: Client, symbol: str) -> SymbolRules:
    """Base/quote asset and quantity step of the symbol."""
    info = client.get_symbol_info(symbol)
    if info is None:
        raise RuntimeError(f"Unknown symbol on the testnet: {symbol}")
    filters = {f["filterType"]: f for f in info["filters"]}
    return SymbolRules(symbol=symbol, base_asset=info["baseAsset"], quote_asset=info["quoteAsset"],
                       lot_step=Decimal(filters["LOT_SIZE"]["stepSize"]))


def round_down_to_step(quantity: float, step: Decimal) -> str:
    """Quantity rounded down to a whole number of steps, as text for the order."""
    steps = (Decimal(str(quantity)) / step).to_integral_value(rounding=ROUND_DOWN)
    return f"{(steps * step).normalize():f}"


def place_market_buy(client: Client, symbol: str, quote_amount: float) -> dict:
    """Market buy that spends quote_amount of the quote asset (USDT for BTCUSDT)."""
    return client.order_market_buy(symbol=symbol, quoteOrderQty=f"{quote_amount:.2f}")


def place_market_sell(client: Client, rules: SymbolRules, quantity: float) -> dict:
    """Market sell of quantity, rounded down to the allowed step."""
    return client.order_market_sell(symbol=rules.symbol, quantity=round_down_to_step(quantity, rules.lot_step))


def fetch_open_orders(client: Client, symbol: str) -> list[dict]:
    """Orders of the symbol that are still on the book."""
    return client.get_open_orders(symbol=symbol)


def fetch_my_trades(client: Client, symbol: str) -> list[dict]:
    """Most recent fills of the symbol, oldest first."""
    return client.get_my_trades(symbol=symbol, limit=MY_TRADES_LIMIT)
