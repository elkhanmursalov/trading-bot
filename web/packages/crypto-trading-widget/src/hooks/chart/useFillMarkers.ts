import { useEffect, useRef } from "react";
import { createSeriesMarkers, type ISeriesApi, type ISeriesMarkersPluginApi, type Time } from "lightweight-charts";

import type { ChartColors } from "../../styles/chartColors";
import type { Execution } from "../../types/backend";
import type { Interval } from "../../types/widget";
import { toFillMarkers } from "../../utils/chartOverlays";

/** Buy/Sell arrows on the candles where orders filled. `firstCandleTime` is null until candles are loaded. */
export function useFillMarkers(
  series: ISeriesApi<"Candlestick"> | null,
  executions: Execution[] | undefined,
  interval: Interval,
  firstCandleTime: number | null,
  colors: ChartColors,
): void {
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

  useEffect(() => {
    if (!series) return;
    const markers = createSeriesMarkers(series, []);
    markersRef.current = markers;
    return () => {
      markers.detach();
      markersRef.current = null;
    };
  }, [series]);

  useEffect(() => {
    const ready = executions && firstCandleTime !== null;
    markersRef.current?.setMarkers(ready ? toFillMarkers(executions, interval, firstCandleTime, colors) : []);
  }, [series, executions, interval, firstCandleTime, colors]);
}
