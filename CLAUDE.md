# CLAUDE.md

## Working rules

- **Plan before changing anything.** Before editing, creating, moving or deleting any file, present a short plan of what will change and wait for approval. Do not touch files until the user agrees.
- **Keep this file up to date.** Whenever the user mentions something about this codebase (data, conventions, preferences, structure, decisions), add it to the "Project notes" section below.
- **Notebooks:** read the current notebook from disk right before editing it. The user edits notebooks in VS Code at the same time, so the file may have changed. Add new cells instead of rewriting or removing existing ones unless asked.
- **Git staging belongs to the user.** Never unstage files the user staged, and never run commands that change the staging area or history (`git reset`, `git rm --cached`, `git restore --staged`, `git stash`, `git checkout`, commits, rebases) unless the user asks for that exact action. Use `git mv` for moves only when the move itself is approved.

## Project notes

- **Data:** `BTCUSDT/` holds Binance spot BTCUSDT 1-hour candles, one CSV per month from `BTCUSDT-1h-2017-08.csv` to `BTCUSDT-1h-2026-10.csv`.
- **CSV format:** no header row. There are 12 columns: open time, open, high, low, close, volume (BTC), close time, quote volume (USDT), number of trades, taker buy volume (BTC), taker buy volume (USDT), ignore.
- **Timestamps:** files before 2025 are in milliseconds and files from 2025 on are in microseconds. Convert each with the right unit.
- **Column naming preference:** use clear, readable names (e.g. "Open Price", "Volume (BTC)"), not abbreviations.
- **Date preference:** keep date and time in one column, formatted `YYYY-MM-DD HH:MM:SS`. Do not split into year/month/day/time.
- **Folder layout:** `backend/` holds all Python: `backend/notebooks/main.ipynb` (main working notebook, research) and, from stage 2, `backend/app/` (FastAPI + bot + shared strategy code that the notebook imports). `web/` holds the React widget. `.env`, `.gitignore`, `CLAUDE.md` stay in the root; `logs/` is in the root too.
- **Railway gets only what it needs:** `backend/.dockerignore` keeps the notebook, dev requirements, caches and `.env` out of the deployed service. Add anything else not needed in production there.
- **`old/` is test material only** (old notebooks incl. `strategy.ipynb`, `btc_usdt.ipynb`, testnet/stream experiments). Do not use or build on it unless the user says so.
- **Demo goal:** first strategy is a simple trend-following demo meant to produce a visible (roughly daily) trade history with small amounts, not profit. More advanced strategies will be added later.
- **Data source:** market data comes from the Binance public API (`GET /api/v3/klines`, no key), not from CSV files. The `BTCUSDT/` CSVs are not used for the current work.
- **Paper trading:** the future bot trades on Binance Spot Testnet using `BINANCE_TESTNET_API_KEY` / `BINANCE_TESTNET_SECRET_KEY` from `.env`. Never print or log the key values.
- **Python environment:** notebooks run on the Anaconda base env (`/opt/anaconda3/bin/python`, Python 3.14, pandas 3). The system `python3` is a different interpreter.
- **Work step by step:** build one stage at a time, each with visible results (tables, text, charts), and do not build later stages until asked. Stage lists the user gives are examples, not a fixed sequence; choose what makes sense. Use widely used, job-market libraries (pandas, numpy, requests, matplotlib, seaborn, plotly).
- **Notebook progress (`backend/notebooks/main.ipynb`):** Step 1 (market data: fetch, inspect, clean, quality checks, candlestick/daily charts, summary) is done; the clean hourly table is `candles`, daily is `daily`.
- **Code style preference:** clean architecture. Use small focused functions with docstrings and type hints, put config (paths, column lists) in named constants, and keep naming/format details hidden behind function arguments (e.g. `year, month` instead of file names).
- **Web widget (monorepo):** `web/` is a pnpm workspace. `web/packages/crypto-trading-widget` is the React package `@elkhanmursalov/crypto-trading-widget`, component `TradingWidget` (live candlestick chart with crosshair and a one-row interval button bar in the header; orders panel with Open orders / Execution history tabs to come). `web/apps/playground` is a Vite dev app that imports the widget from source. Run with `pnpm dev` in `web/`; build with `pnpm build`; check types with `pnpm typecheck`. The playground depends on the widget via `workspace:*`.
- **Widget consumers:** two Next.js apps in separate repos install the package from GitHub Packages (scope must be the GitHub account `elkhanmursalov`). The package ships ESM + CSS with a `"use client"` banner; React and lightweight-charts are external.
- **Backend plan:** simple FastAPI service on Railway (always on), runs the bot as a background task and serves open orders, 30-day trade history and position to the widget, plus a live stream. No CSV logs or database: position and history come from Binance testnet (`myTrades`). Read-only, CORS-limited to the two apps. Testnet resets wipe history, which is accepted.
- **Widget chart overlays (planned):** open orders as dashed price lines, open position as an entry line with live P/L, buy/sell fill markers.
- **Multi-coin later:** the widget is named generically so other pairs can be added (`symbol` prop already works). Still to do when needed: price decimals from Binance exchange info (fixed at 2 today) and a symbol picker in the header.
- **Widget theme:** set only through the `theme` prop (`"light"` default, `"dark"`, `"auto"` = follows the system setting); the widget has no theme switch of its own.
