import { useState } from "react";

import { IntervalBar } from "./IntervalBar";
import { PriceChart } from "./PriceChart";
import { useResolvedTheme } from "./useResolvedTheme";
import type { Interval, StreamStatus, Theme } from "./types";

const STATUS_LABELS: Record<StreamStatus, string> = {
  connecting: "Connecting",
  live: "Live",
  reconnecting: "Reconnecting",
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
  /** Override for the Binance REST base URL. */
  restUrl?: string;
  /** Override for the Binance WebSocket base URL. */
  streamUrl?: string;
  /** Extra class name on the root element. */
  className?: string;
}

/** Live price chart with interval buttons; the orders panel is added below it in a later stage. */
export function TradingWidget({
  symbol = "BTCUSDT",
  defaultInterval = "1h",
  intervals = DEFAULT_INTERVALS,
  onIntervalChange,
  theme = "light",
  chartHeight = 480,
  historyLimit = 500,
  restUrl,
  streamUrl,
  className,
}: TradingWidgetProps) {
  const [interval, setInterval] = useState<Interval>(defaultInterval);
  const resolvedTheme = useResolvedTheme(theme);
  const [status, setStatus] = useState<StreamStatus>("connecting");

  const selectInterval = (next: Interval) => {
    setInterval(next);
    onIntervalChange?.(next);
  };

  return (
    <div className={["btw-root", className].filter(Boolean).join(" ")} data-theme={resolvedTheme}>
      <div className="btw-header">
        <span className="btw-symbol">{symbol}</span>
        <IntervalBar intervals={intervals} selected={interval} onSelect={selectInterval} />
        <span className="btw-status" data-status={status}>
          {STATUS_LABELS[status]}
        </span>
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
      />
    </div>
  );
}
