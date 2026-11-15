# CLAUDE.md

## Working rules

- **Plan before changing anything.** Before editing, creating, moving or deleting any file, present a short plan of what will change and wait for approval. Do not touch files until the user agrees.
- **Keep this file up to date.** Whenever the user mentions something about this codebase (data, conventions, preferences, structure, decisions), add it to the matching section below.
- **Notebooks:** read the current notebook from disk right before editing it. The user edits notebooks in VS Code at the same time, so the file may have changed. Add new cells instead of rewriting or removing existing ones unless asked.
- **Git staging belongs to the user.** Never unstage files the user staged, and never run commands that change the staging area or history (`git reset`, `git rm --cached`, `git restore --staged`, `git stash`, `git checkout`, commits, rebases) unless the user asks for that exact action. Use `git mv` for moves only when the move itself is approved.
- **Work step by step.** Build one stage at a time, each with visible results (tables, text, charts), and do not build later stages until asked. Stage lists the user gives are examples, not a fixed sequence.
- **Clean code, always:**
  - Group files into folders by meaning: all React components under `components/` (grouped further by feature, e.g. `components/chart/`), and separate folders for `data/` (talking to Binance or the backend), `hooks/`, `types/`, `utils/`, `styles/`. Python follows the same idea by module (`market`, `strategy`, `exchange`, `account`, `bot`).
  - One component or one job per file. Small functions with clear names, docstrings or doc comments, and type hints.
  - No duplicated logic: shared code lives in one place and is imported (e.g. the notebook imports from `backend/app/`).
  - Constants and config are named, never magic numbers or strings inline.
  - Remove dead code, unused imports and stale references after every change (including config files outside `src/`, such as aliases in `vite.config.ts`).
  - When a folder grows past about 6–8 files, propose grouping before adding more.

## Project overview

- **Goal:** a BTC/USDT demo. A simple trend-following bot trades on the Binance Spot Testnet, and a React widget shows the live chart, open orders and trade history. The demo should produce a visible (roughly daily) trade history with small amounts, not profit. More advanced strategies come later.
- **Strategy:** SMA crossover (fast 12, slow 48 candles, 1h), long only, 100 USDT per trade, 0.1% fee per side.
- **Paper trading only:** the bot uses `BINANCE_TESTNET_API_KEY` / `BINANCE_TESTNET_SECRET_KEY` (from `.env` locally, from Railway variables in production). **Never print or log the key values.** The live keys in `.env` are not used.
- **Market data:** the Binance public API (`GET /api/v3/klines`, no key).

## Folder layout

```
trading-bot/
├── backend/                  all Python
│   ├── app/                  FastAPI service + bot + shared strategy code (deployed to Railway)
│   ├── notebooks/main.ipynb  research notebook; imports from app/
│   ├── requirements.txt      what Railway installs
│   ├── requirements-dev.txt  extras for the notebook
│   └── .dockerignore         keeps the notebook, dev files, caches and .env out of the deployed service
├── web/                      pnpm workspace: React widget + playground
├── .env  .gitignore  CLAUDE.md   stay in the root
├── logs/                     CSV log of the notebook's own bot (git-ignored)
├── BTCUSDT/                  old CSV candles, not used for current work
└── old/                      test material only; do not use or build on it unless the user says so
```

## Backend (`backend/`)

- **Run locally:** from `backend/`, `BOT_MODE=dry_run .venv/bin/uvicorn app.main:app --reload`. Own venv in `backend/.venv`. API docs at `/docs`.
- **Settings (environment variables):**
  - `BOT_MODE`: `off` (default, API only), `dry_run` (decides, no orders), `testnet` (sends orders). Only one place may run `testnet` at a time (Railway, local backend or notebook bot), or orders double.
  - `CORS_ORIGINS`: comma-separated allowed origins (default `http://localhost:5173`).
  - Optional: `SYMBOL`, `INTERVAL`, `TRADE_SIZE_USDT`.
- **Endpoints (read-only):** `/api/health`, `/api/position`, `/api/open-orders`, `/api/trades?days=30`, `/api/bot`, `/api/stream` (Server-Sent Events with two event types, `account` and `bot`; each is sent on connect and again whenever it changes; `backend/app/events.py` is the hub that fans messages out).
- **No database, no CSV on the server:** position and history come from Binance testnet (`myTrades`, open orders). The position is the last order if it was a buy. Executions combine the fills of each order into one row. Testnet resets wipe the history, which is accepted.
- **Shared code:** the notebook imports from `backend/app/` (the first cell puts `backend/` on `sys.path`). Change shared logic in `app/`, not in the notebook. The notebook's own bot (section 9) still keeps its position in a CSV in `logs/`.
- **Python environment for notebooks:** Anaconda base env (`/opt/anaconda3/bin/python`, Python 3.14, pandas 3). The system `python3` is a different interpreter.

## Deployment (Railway)

- **Live URL:** `https://api.example.com` (always on, bot runs in `testnet` mode).
- **Service settings:** root directory `backend`; start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`; variable `PORT=8000`; health check `/api/health`.
- **Variables:** the two testnet keys, `BOT_MODE`, `CORS_ORIGINS`, `RAILWAY_DEPLOYMENT_OVERLAP_SECONDS=0`.
- Not yet confirmed: that Railway really leaves the notebook out of the build (`.dockerignore`).

## Web widget (`web/`)

- **Workspace:** pnpm. In `web/`: `pnpm dev` (playground), `pnpm build` (package), `pnpm typecheck`.
- **Package (the product):** `web/packages/crypto-trading-widget` is `@elkhanmursalov/crypto-trading-widget`, component `TradingWidget`; this is what the Next.js apps install.
- **Playground (local test page only, never published):** `web/apps/playground`, a Vite app that imports the widget from source (`workspace:*`).
- **Widget source layout (`src/`):**
  ```
  index.ts            public exports (imports styles/base.css first)
  components/         TradingWidget.tsx; chart/ (PriceChart, IntervalBar); orders/ (OrdersPanel, OpenOrdersTable,
                      ExecutionsTable, PositionLine, SideCell); bot/ (BotBadge)
  data/               binance.ts (candles REST + WebSocket), useAccountStream.ts (backend SSE)
  hooks/              useNow, useResolvedTheme
  types/              widget.ts (Candle, Interval, Theme...), backend.ts (shapes sent by the backend)
  utils/              format.ts (numbers, times, asset amounts), botStatus.ts (bot badge wording)
  styles/             base.css, chart.css, orders.css, bot.css, chartColors.ts; each component imports its own CSS;
                      the build merges them into one style.css
  ```
- **Amount formatting:** fees and asset amounts use the asset's fixed decimals (`formatAssetAmount`: BTC 8 decimals, USDT 2), e.g. `0.00000000 BTC`. The testnet charges no fees, so they show as zero.
- **Chart:** live candles with crosshair and OHLC legend, volume pane, one-row interval buttons in the header. Candles and live ticks come straight from Binance (REST + WebSocket).
- **Theme:** only through the `theme` prop (`"light"` default, `"dark"`, `"auto"` = follows the system setting). The widget has no theme switch of its own.
- **Orders panel and bot status:** shown only when the `apiBaseUrl` prop is set (the backend URL). Below the chart: position line and two tabs, Open orders and Execution history (30 days). The header shows a bot badge (running / dry run / off / error / not responding) with the next check time. All of it comes from one `/api/stream` connection (`useAccountStream`), not from Binance, because it needs the secret key. Without `apiBaseUrl` the widget is just the chart.
- **Playground:** `apps/playground/.env.development` sets `VITE_API_URL` to the Railway URL. For a local backend run `VITE_API_URL=http://localhost:8000 pnpm dev`. The backend's `CORS_ORIGINS` must include the playground origin (`http://localhost:5173`).
- **Consumers:** two Next.js apps in separate repos install the package from GitHub Packages (the scope must be the GitHub account `elkhanmursalov`). The package ships ESM + CSS with a `"use client"` banner; React and lightweight-charts are external.
- **Multi-coin later:** the `symbol` prop already works. Still missing: price decimals from Binance exchange info (fixed at 2) and a symbol picker in the header.

## Preferences

- **Column names:** clear and readable (e.g. "Open Price", "Volume (BTC)"), not abbreviations.
- **Dates:** date and time in one column, formatted `YYYY-MM-DD HH:MM:SS`.
- **Code style:** clean architecture. Small focused functions with docstrings and type hints, config in named constants, naming and format details behind function arguments.
- **Libraries:** widely used, job-market libraries (pandas, numpy, requests, matplotlib, seaborn, plotly).
- **Notebook text:** descriptive, never instructions to the reader; code cells first, observations after the output.

## Old CSV data (not used for current work)

`BTCUSDT/` holds Binance spot BTCUSDT 1-hour candles, one CSV per month from `BTCUSDT-1h-2017-08.csv` to `BTCUSDT-1h-2026-10.csv`. No header row, 12 columns: open time, open, high, low, close, volume (BTC), close time, quote volume (USDT), number of trades, taker buy volume (BTC), taker buy volume (USDT), ignore. Files before 2025 use milliseconds, files from 2025 on use microseconds.

## Roadmap

Done:
- [x] Notebook: market data → SMA indicators → signals → backtest → testnet connection → live bot
- [x] Widget stage 1: live candles, crosshair, volume, interval buttons, `theme` prop
- [x] Repo layout (`backend/`, `web/`), pnpm workspace
- [x] Backend (stage 2): FastAPI endpoints, SSE stream, bot as background task; the notebook imports the shared code
- [x] Railway deploy (stage 5, done early): backend live and the bot running in `testnet` mode
- [x] Stage 3 – Orders panel (Open orders / Execution history), bot status badge, live from `/api/stream`. Needs a Railway redeploy of the backend to show the bot badge and the asset names in the table headers.

To do:
- [ ] Stage 4 – Chart overlays: open orders as dashed lines, open position line with live P/L, buy/sell fill markers
- [ ] Stage 6 – Publish the widget to GitHub Packages, usage example for the Next.js apps

Later:
- [ ] Multi-coin: price decimals from Binance exchange info, symbol picker
- [ ] Lock the backend (Next.js server proxy + secret token) before any live keys are used
