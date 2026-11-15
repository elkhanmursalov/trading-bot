import type { LineData, UTCTimestamp } from "lightweight-charts";

import type { Candle } from "../types/widget";

/** Simple moving average of the close price over `window` candles ending at `index`; null until there are enough. */
export function smaAt(candles: Candle[], index: number, window: number): number | null {
  if (index < window - 1 || index >= candles.length) return null;
  let sum = 0;
  for (let i = index - window + 1; i <= index; i++) sum += candles[i].close;
  return sum / window;
}

/** SMA value at the candle that opens at `time` (seconds), or null. */
export function smaAtTime(candles: Candle[], time: number, window: number): number | null {
  return smaAt(candles, candles.findIndex((c) => c.time === time), window);
}

/** SMA line points for all candles; the first `window - 1` candles have no value yet. */
export function smaLine(candles: Candle[], window: number): LineData[] {
  const points: LineData[] = [];
  for (let i = window - 1; i < candles.length; i++) {
    points.push({ time: candles[i].time as UTCTimestamp, value: smaAt(candles, i, window) as number });
  }
  return points;
}
