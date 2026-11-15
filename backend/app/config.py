"""Settings. Values come from environment variables (Railway) or the project-root .env (local)."""

import os

from dotenv import load_dotenv

load_dotenv()  # finds the project-root .env when run locally; no-op on Railway

# Market and strategy
BINANCE_PUBLIC_URL = "https://api.binance.com"   # public market data, no key
SYMBOL = os.getenv("SYMBOL", "BTCUSDT")
INTERVAL = os.getenv("INTERVAL", "1h")
MAX_LIMIT = 1000                                  # Binance returns at most 1000 candles per request
FAST_WINDOW = 12
SLOW_WINDOW = 48
TRADE_SIZE_USDT = float(os.getenv("TRADE_SIZE_USDT", "100"))
FEE_RATE = 0.001

# Bot
BOT_MODES = ("off", "dry_run", "testnet")
BOT_MODE = os.getenv("BOT_MODE", "off")           # off: no bot | dry_run: decide only | testnet: send orders
CHECK_DELAY_SECONDS = 10                          # wait after each candle close so Binance has finished it
MAX_SLEEP_STEP_SECONDS = 30                       # wait in short steps against the wall clock

# API
ACCOUNT_POLL_SECONDS = 5                          # how often open orders / trades are refreshed for the widget
HISTORY_DAYS_DEFAULT = 30
HISTORY_DAYS_MAX = 90
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

# Testnet keys: names only; the values are never printed or logged
TESTNET_KEY_NAMES = ("BINANCE_TESTNET_API_KEY", "BINANCE_TESTNET_SECRET_KEY")

if BOT_MODE not in BOT_MODES:
    raise RuntimeError(f"BOT_MODE must be one of {BOT_MODES}, got {BOT_MODE!r}")
