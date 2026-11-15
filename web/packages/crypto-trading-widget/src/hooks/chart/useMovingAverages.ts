import { useEffect, useRef, type RefObject } from "react";
import { LineSeries, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";

import type { ChartColors } from "../../styles/chartColors";
import type { Candle, MovingAverageSettings } from "../../types/widget";
import { smaAt, smaLine } from "../../utils/indicators";

const LINE_WIDTH = 2;

interface AverageLines {
  fast: ISeriesApi<"Line">;
  slow: ISeriesApi<"Line">;
}

/**
 * The strategy's fast and slow SMA as two lines on the price pane.
 * `settings` null hides them. `historyVersion` changes after every full candle load; `latest` on every tick.
 */
export function useMovingAverages(
  chart: IChartApi | null,
  candlesRef: RefObject<Candle[]>,
  historyVersion: number,
  latest: Candle | null,
  settings: MovingAverageSettings | null,
  colors: ChartColors,
): void {
  const linesRef = useRef<AverageLines | null>(null);
  const fast = settings?.fast ?? null;
  const slow = settings?.slow ?? null;

  // Add the two lines while the averages are enabled; remove them when disabled.
  useEffect(() => {
    if (!chart || fast === null || slow === null) return;
    const options = { lineWidth: LINE_WIDTH, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false } as const;
    const lines = {
      fast: chart.addSeries(LineSeries, options, 0),
      slow: chart.addSeries(LineSeries, options, 0),
    };
    linesRef.current = lines;
    return () => {
      chart.removeSeries(lines.fast);
      chart.removeSeries(lines.slow);
      linesRef.current = null;
    };
  }, [chart, fast, slow]);

  // Colours follow the theme.
  useEffect(() => {
    linesRef.current?.fast.applyOptions({ color: colors.smaFast });
    linesRef.current?.slow.applyOptions({ color: colors.smaSlow });
  }, [chart, fast, slow, colors]);

  // Full lines after every candle load.
  useEffect(() => {
    const lines = linesRef.current;
    if (!lines || fast === null || slow === null) return;
    lines.fast.setData(smaLine(candlesRef.current, fast));
    lines.slow.setData(smaLine(candlesRef.current, slow));
  }, [chart, fast, slow, historyVersion, candlesRef]);

  // Live: move the last point of each line with the current candle.
  useEffect(() => {
    const lines = linesRef.current;
    const candles = candlesRef.current;
    const index = candles.length - 1;
    if (!lines || !latest || fast === null || slow === null || candles[index]?.time !== latest.time) return;
    const fastValue = smaAt(candles, index, fast);
    const slowValue = smaAt(candles, index, slow);
    if (fastValue !== null) lines.fast.update({ time: latest.time as UTCTimestamp, value: fastValue });
    if (slowValue !== null) lines.slow.update({ time: latest.time as UTCTimestamp, value: slowValue });
  }, [chart, fast, slow, latest, candlesRef]);
}
