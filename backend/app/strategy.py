"""SMA crossover strategy: moving averages, trend and Buy/Sell signals."""

from datetime import datetime, timezone

import numpy as np
import pandas as pd

from .config import FAST_WINDOW, SLOW_WINDOW
from .market import RAW_COLUMNS, clean_klines, fetch_klines

FAST_COLUMN = f"Fast SMA ({FAST_WINDOW})"
SLOW_COLUMN = f"Slow SMA ({SLOW_WINDOW})"
BUY, SELL = "Buy", "Sell"
UPTREND, DOWNTREND = "Up", "Down"


def add_moving_averages(df: pd.DataFrame, fast: int, slow: int) -> pd.DataFrame:
    """Return a copy of the candles with a fast and a slow SMA of the close price."""
    df = df.copy()
    df[FAST_COLUMN] = df["Close Price"].rolling(fast).mean()
    df[SLOW_COLUMN] = df["Close Price"].rolling(slow).mean()
    return df


def add_signals(df: pd.DataFrame) -> pd.DataFrame:
    """Return a copy with the trend of every candle and a Buy/Sell signal where the fast SMA crosses the slow SMA."""
    df = df.copy()
    ready = df[SLOW_COLUMN].notna()                      # both averages exist
    fast_above = df[FAST_COLUMN] > df[SLOW_COLUMN]
    was_above = fast_above.shift(1, fill_value=False)
    was_ready = ready.shift(1, fill_value=False)

    crossed_up = ready & was_ready & fast_above & ~was_above
    crossed_down = ready & was_ready & ~fast_above & was_above

    df["Trend"] = np.where(~ready, "", np.where(fast_above, UPTREND, DOWNTREND))
    df["Signal"] = np.select([crossed_up, crossed_down], [BUY, SELL], default="")
    return df


def latest_closed_candle(symbol: str, interval: str) -> pd.Series:
    """Last closed candle from the real market with its SMAs, trend and signal."""
    now = datetime.now(timezone.utc)
    start = now - pd.Timedelta(interval) * (SLOW_WINDOW + 5)    # enough history for the slow SMA
    raw = pd.DataFrame(fetch_klines(symbol, interval, start, now), columns=RAW_COLUMNS)
    candles = add_signals(add_moving_averages(clean_klines(raw, now), FAST_WINDOW, SLOW_WINDOW))
    return candles.iloc[-1]
