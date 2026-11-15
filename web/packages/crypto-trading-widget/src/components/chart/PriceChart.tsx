import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type UTCTimestamp,
} from "lightweight-charts";

import "../../styles/chart.css";
import { fetchCandles, subscribeCandles } from "../../data/binance";
import { formatChange, formatPrice, formatTimeUtc, formatVolume } from "../../utils/format";
import { CHART_COLORS, type ChartColors } from "../../styles/chartColors";
import type { Candle, Interval, ResolvedTheme, StreamStatus } from "../../types/widget";

const PRICE_PANE_STRETCH = 3;
const VOLUME_PANE_STRETCH = 1;

export interface PriceChartProps {
  symbol: string;
  interval: Interval;
  theme: ResolvedTheme;
  height: number;
  historyLimit: number;
  restUrl?: string;
  streamUrl?: string;
  onStatusChange?: (status: StreamStatus) => void;
}

interface ChartHandles {
  chart: IChartApi;
  candles: ISeriesApi<"Candlestick">;
  volume: ISeriesApi<"Histogram">;
}

function toBar(c: Candle): CandlestickData {
  return { time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close };
}

function toVolumeBar(c: Candle, colors: ChartColors): HistogramData {
  return {
    time: c.time as UTCTimestamp,
    value: c.volume,
    color: c.close >= c.open ? colors.upVolume : colors.downVolume,
  };
}

/** Options that depend on the colour theme. */
function themeOptions(colors: ChartColors) {
  return {
    layout: {
      background: { type: ColorType.Solid, color: colors.background },
      textColor: colors.text,
      panes: { separatorColor: colors.border },
    },
    grid: {
      vertLines: { color: colors.grid },
      horzLines: { color: colors.grid },
    },
    rightPriceScale: { borderColor: colors.border },
    timeScale: { borderColor: colors.border },
    crosshair: {
      vertLine: { color: colors.crosshair, labelBackgroundColor: colors.crosshair },
      horzLine: { color: colors.crosshair, labelBackgroundColor: colors.crosshair },
    },
  };
}

/** Candlestick chart with a volume pane, hover crosshair, OHLC legend and live updates. */
export function PriceChart({
  symbol,
  interval,
  theme,
  height,
  historyLimit,
  restUrl,
  streamUrl,
  onStatusChange,
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handlesRef = useRef<ChartHandles | null>(null);
  const colorsRef = useRef<ChartColors>(CHART_COLORS[theme]);
  const volumesRef = useRef<Map<number, number>>(new Map());
  const statusRef = useRef(onStatusChange);
  statusRef.current = onStatusChange;

  const [latest, setLatest] = useState<Candle | null>(null);
  const [hovered, setHovered] = useState<Candle | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create the chart once; remove it on unmount.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { timeVisible: true, secondsVisible: false, rightOffset: 5 },
      localization: { priceFormatter: formatPrice },
    });
    const candles = chart.addSeries(CandlestickSeries, {
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });
    const volume = chart.addSeries(
      HistogramSeries,
      { priceFormat: { type: "volume" }, priceLineVisible: false, lastValueVisible: false },
      1,
    );
    chart.panes()[0].setStretchFactor(PRICE_PANE_STRETCH);
    chart.panes()[1].setStretchFactor(VOLUME_PANE_STRETCH);

    const onCrosshairMove = (param: MouseEventParams) => {
      const bar = param.seriesData.get(candles) as CandlestickData | undefined;
      if (!param.time || !bar) {
        setHovered(null);
        return;
      }
      const time = param.time as number;
      setHovered({
        time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: volumesRef.current.get(time) ?? 0,
      });
    };
    chart.subscribeCrosshairMove(onCrosshairMove);

    handlesRef.current = { chart, candles, volume };
    return () => {
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      chart.remove();
      handlesRef.current = null;
    };
  }, []);

  // Apply colours whenever the theme changes.
  useEffect(() => {
    const handles = handlesRef.current;
    if (!handles) return;
    const colors = CHART_COLORS[theme];
    colorsRef.current = colors;
    handles.chart.applyOptions(themeOptions(colors));
    handles.candles.applyOptions({
      upColor: colors.up,
      downColor: colors.down,
      borderUpColor: colors.up,
      borderDownColor: colors.down,
      wickUpColor: colors.up,
      wickDownColor: colors.down,
    });
  }, [theme]);

  // Load history, then follow the live stream. Restarts when symbol/interval change.
  useEffect(() => {
    const handles = handlesRef.current;
    if (!handles) return;

    const controller = new AbortController();
    let ready = false; // history loaded; until then live updates are buffered
    let pending: Candle[] = [];
    let lastTime = 0;

    const applyCandle = (c: Candle) => {
      if (c.time < lastTime) return; // the chart only accepts the latest candle or a newer one
      handles.candles.update(toBar(c));
      handles.volume.update(toVolumeBar(c, colorsRef.current));
      volumesRef.current.set(c.time, c.volume);
      lastTime = c.time;
      setLatest(c);
    };

    const loadHistory = async () => {
      ready = false;
      try {
        const history = await fetchCandles(symbol, interval, historyLimit, restUrl, controller.signal);
        if (controller.signal.aborted) return;
        handles.candles.setData(history.map(toBar));
        handles.volume.setData(history.map((c) => toVolumeBar(c, colorsRef.current)));
        volumesRef.current = new Map(history.map((c) => [c.time, c.volume]));
        lastTime = history.at(-1)?.time ?? 0;
        if (history.length) setLatest(history[history.length - 1]);
        ready = true;
        pending.forEach(applyCandle);
        pending = [];
        setError(null);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    };

    void loadHistory();
    const unsubscribe = subscribeCandles(
      symbol,
      interval,
      {
        onCandle: (c) => (ready ? applyCandle(c) : pending.push(c)),
        onStatus: (status) => statusRef.current?.(status),
        onReconnected: () => void loadHistory(), // fill candles missed while disconnected
      },
      streamUrl,
    );

    return () => {
      controller.abort();
      unsubscribe();
      setLatest(null);
    };
  }, [symbol, interval, historyLimit, restUrl, streamUrl]);

  const shown = hovered ?? latest;
  const direction = shown && shown.close >= shown.open ? "up" : "down";

  return (
    <div className="btw-chart" style={{ height }}>
      <div ref={containerRef} className="btw-chart-canvas" />
      {shown && (
        <div className="btw-legend" data-direction={direction}>
          <span className="btw-legend-time">{formatTimeUtc(shown.time)} UTC</span>
          <span>O <b>{formatPrice(shown.open)}</b></span>
          <span>H <b>{formatPrice(shown.high)}</b></span>
          <span>L <b>{formatPrice(shown.low)}</b></span>
          <span>C <b>{formatPrice(shown.close)}</b></span>
          <span className="btw-legend-change">{formatChange(shown.open, shown.close)}</span>
          <span>Vol <b>{formatVolume(shown.volume)}</b></span>
        </div>
      )}
      {error && <div className="btw-error">Price data unavailable: {error}</div>}
    </div>
  );
}
