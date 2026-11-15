import { useState } from "react";

import { BotBadge } from "./bot/BotBadge";
import { IntervalBar } from "./chart/IntervalBar";
import { OrdersPanel } from "./orders/OrdersPanel";
import { PriceChart } from "./chart/PriceChart";
import { useAccountStream } from "../data/useAccountStream";
import { useResolvedTheme } from "../hooks/useResolvedTheme";
import type { Interval, StreamStatus, Theme } from "../types/widget";

const STATUS_LABELS: Record<StreamStatus, string> = {
  connecting: "Price connecting",
  live: "Price live",
  reconnecting: "Price reconnecting",
};

export const DEFAULT_INTERVALS: Interval[] = ["1m", "5m", "15m", "1h", "4h", "1d"];

export interface TradingWidgetProps {
  /** Binance symbol, e.g. "BTCUSDT" or "ETHUSDT". */
  symbol?: string;
  /** Interval selected when the widget first appears. */
  defaultInterval?: Interval;
  /** Interval buttons shown in the header, in this order. */
  intervals?: Interval[];
  /** Called when the user picks another interval. */
  onIntervalChange?: (interval: Interval) => void;
  /** Colour scheme: "light", "dark", or "auto" to follow the computer's setting. */
  theme?: Theme;
  /** Chart height in pixels (price + volume panes). */
  chartHeight?: number;
  /** Number of past candles to load (max 1000). */
  historyLimit?: number;
  /**
   * Base URL of the trading backend, e.g. "https://api.example.com".
   * Adds the bot status and the orders panel (open orders, execution history).
   * Without it the widget shows only the chart.
   */
  apiBaseUrl?: string;
  /** Override for the Binance REST base URL. */
  restUrl?: string;
  /** Override for the Binance WebSocket base URL. */
  streamUrl?: string;
  /** Extra class name on the root element. */
  className?: string;
}

/** Live price chart with interval buttons and, when `apiBaseUrl` is set, the bot status and the orders panel. */
export function TradingWidget({
  symbol = "BTCUSDT",
  defaultInterval = "1h",
  intervals = DEFAULT_INTERVALS,
  onIntervalChange,
  theme = "light",
  chartHeight = 480,
  historyLimit = 500,
  apiBaseUrl,
  restUrl,
  streamUrl,
  className,
}: TradingWidgetProps) {
  const [interval, setInterval] = useState<Interval>(defaultInterval);
  const resolvedTheme = useResolvedTheme(theme);
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const { account, bot, status: accountStatus } = useAccountStream(apiBaseUrl);
  // The bot decides on its own interval only, so its SMAs are drawn only when the chart shows that interval.
  const movingAverages =
    bot?.fast_window && bot.slow_window && bot.interval === interval
      ? { fast: bot.fast_window, slow: bot.slow_window }
      : null;

  const selectInterval = (next: Interval) => {
    setInterval(next);
    onIntervalChange?.(next);
  };

  return (
    <div className={["btw-root", className].filter(Boolean).join(" ")} data-theme={resolvedTheme}>
      <div className="btw-header">
        <span className="btw-symbol">{symbol}</span>
        <IntervalBar intervals={intervals} selected={interval} onSelect={selectInterval} />
        <div className="btw-badges">
          <BotBadge bot={bot} stream={accountStatus} />
          <span className="btw-status" data-status={status}>
            {STATUS_LABELS[status]}
          </span>
        </div>
      </div>
      <PriceChart
        symbol={symbol}
        interval={interval}
        theme={resolvedTheme}
        height={chartHeight}
        historyLimit={historyLimit}
        restUrl={restUrl}
        streamUrl={streamUrl}
        onStatusChange={setStatus}
        account={account}
        movingAverages={movingAverages}
      />
      {apiBaseUrl && <OrdersPanel account={account} stream={accountStatus} />}
    </div>
  );
}
