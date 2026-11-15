"""Public market data: download candles from Binance and turn them into a clean table."""

import time
from datetime import datetime

import pandas as pd
import requests

from .config import BINANCE_PUBLIC_URL, MAX_LIMIT

RAW_COLUMNS = ["open_time", "open", "high", "low", "close", "volume",
               "close_time", "quote_volume", "trades",
               "taker_buy_base_volume", "taker_buy_quote_volume", "ignore"]
COLUMN_NAMES = {
    "open_time": "Time",
    "open": "Open Price",
    "high": "High Price",
    "low": "Low Price",
    "close": "Close Price",
    "volume": "Volume (BTC)",
    "quote_volume": "Volume (USDT)",
    "trades": "Number of Trades",
}
FLOAT_COLUMNS = ["Open Price", "High Price", "Low Price", "Close Price",
                 "Volume (BTC)", "Volume (USDT)"]


def fetch_klines(symbol: str, interval: str, start: datetime, end: datetime) -> list[list]:
    """Download raw candles from Binance between start and end (UTC), MAX_LIMIT per request."""
    url = f"{BINANCE_PUBLIC_URL}/api/v3/klines"
    start_ms = int(start.timestamp() * 1000)
    end_ms = int(end.timestamp() * 1000)
    rows: list[list] = []

    while start_ms < end_ms:
        params = {"symbol": symbol, "interval": interval,
                  "startTime": start_ms, "endTime": end_ms, "limit": MAX_LIMIT}
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        batch = response.json()
        if not batch:
            break
        rows.extend(batch)
        start_ms = batch[-1][0] + 1   # continue right after the last candle's open time
        time.sleep(0.2)               # stay well inside the API rate limit

    return rows


def drop_unfinished_candle(raw: pd.DataFrame, fetched_at: datetime) -> pd.DataFrame:
    """Remove candles that were still open at download time (their data is a mid-candle snapshot)."""
    fetched_ms = int(fetched_at.timestamp() * 1000)
    return raw[raw["close_time"] < fetched_ms]


def select_and_rename(raw: pd.DataFrame) -> pd.DataFrame:
    """Keep only the columns we use and give them readable names."""
    return raw[list(COLUMN_NAMES)].rename(columns=COLUMN_NAMES)


def convert_types(df: pd.DataFrame) -> pd.DataFrame:
    """Text to numbers, milliseconds to datetime (UTC)."""
    df = df.copy()
    df["Time"] = pd.to_datetime(df["Time"], unit="ms")
    df[FLOAT_COLUMNS] = df[FLOAT_COLUMNS].astype(float)
    df["Number of Trades"] = df["Number of Trades"].astype(int)
    return df


def remove_duplicates(df: pd.DataFrame) -> pd.DataFrame:
    """Keep one candle per time and sort chronologically."""
    return df.drop_duplicates(subset="Time").sort_values("Time")


def clean_klines(raw: pd.DataFrame, fetched_at: datetime) -> pd.DataFrame:
    """Turn raw Binance klines into a clean, time-indexed candle table."""
    return (raw
            .pipe(drop_unfinished_candle, fetched_at)
            .pipe(select_and_rename)
            .pipe(convert_types)
            .pipe(remove_duplicates)
            .set_index("Time"))
