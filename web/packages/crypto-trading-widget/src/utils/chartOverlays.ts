import type { SeriesMarker, Time, UTCTimestamp } from "lightweight-charts";

import type { ChartColors } from "../styles/chartColors";
import type { Execution, OpenOrder } from "../types/backend";
import type { Interval } from "../types/widget";
import { formatPrice, formatQuantity } from "./format";

/** Candle length in seconds per interval. */
const INTERVAL_SECONDS: Record<Interval, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

/** Profit or loss of the open position at the given price, before fees. */
export interface PnL {
  amount: number;   // in the quote asset (USDT)
  percent: number;
}

/** Open time (seconds) of the candle that contains `timeMs`; Binance candles start on whole intervals in UTC. */
export function candleTimeOf(timeMs: number, interval: Interval): number {
  const step = INTERVAL_SECONDS[interval];
  return Math.floor(timeMs / 1000 / step) * step;
}

/** Fills of one side on one candle, merged so their arrows and labels do not overlap. */
interface CandleFills {
  time: number;
  side: Execution["side"];
  count: number;
}

function groupFillsByCandle(executions: Execution[], interval: Interval, firstCandleTime: number): CandleFills[] {
  const groups = new Map<string, CandleFills>();
  for (const e of executions) {
    const time = candleTimeOf(e.time, interval);
    if (time < firstCandleTime) continue;   // candle not loaded on the chart
    const key = `${time}-${e.side}`;
    const group = groups.get(key) ?? { time, side: e.side, count: 0 };
    group.count += 1;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.time - b.time);
}

/**
 * One arrow per side per candle: green up-arrow below the bar for buys, red down-arrow above for sells.
 * No text (it overlaps on neighbouring candles), except a count like "×3" when several orders filled on one candle.
 */
export function toFillMarkers(
  executions: Execution[],
  interval: Interval,
  firstCandleTime: number,
  colors: ChartColors,
): SeriesMarker<Time>[] {
  return groupFillsByCandle(executions, interval, firstCandleTime).map(({ time, side, count }) => ({
    time: time as UTCTimestamp,
    position: side === "BUY" ? "belowBar" : "aboveBar",
    shape: side === "BUY" ? "arrowUp" : "arrowDown",
    color: side === "BUY" ? colors.up : colors.down,
    text: count > 1 ? `×${count}` : "",
  }));
}

export function positionPnl(quantity: number, entryPrice: number, price: number): PnL {
  return {
    amount: (price - entryPrice) * quantity,
    percent: ((price - entryPrice) / entryPrice) * 100,
  };
}

function signed(text: string, value: number): string {
  return `${value >= 0 ? "+" : "-"}${text}`;
}

/** Label on the position line: "Position +0.12 USDT (+0.19%)". */
export function positionLineTitle(pnl: PnL, quote: string): string {
  const amount = signed(formatPrice(Math.abs(pnl.amount)), pnl.amount);
  const percent = signed(`${Math.abs(pnl.percent).toFixed(2)}%`, pnl.percent);
  return `Position ${amount} ${quote} (${percent})`.replace(/\s+/g, " ");
}

/** Label on an open-order line: "BUY 0.0002". */
export function orderLineTitle(order: OpenOrder): string {
  return `${order.side} ${formatQuantity(order.quantity)}`;
}
