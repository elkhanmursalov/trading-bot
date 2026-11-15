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
  type LogicalRange,
  type MouseEventParams,
  type UTCTimestamp,
} from "lightweight-charts";

import "../../styles/chart.css";
import { MAX_LIMIT, fetchCandles, subscribeCandles } from "../../data/binance";
import { useFillMarkers } from "../../hooks/chart/useFillMarkers";
import { useMovingAverages } from "../../hooks/chart/useMovingAverages";
import { useOrderLines } from "../../hooks/chart/useOrderLines";
import { usePositionLine } from "../../hooks/chart/usePositionLine";
import type { AccountSnapshot } from "../../types/backend";
import { formatChange, formatPrice, formatTimeUtc, formatVolume } from "../../utils/format";
import { CHART_COLORS, type ChartColors } from "../../styles/chartColors";
import type { Candle, Interval, MovingAverageSettings, ResolvedTheme, StreamStatus } from "../../types/widget";
import { smaAtTime } from "../../utils/indicators";

const PRICE_PANE_STRETCH = 3;
/** Older candles are loaded when the left edge of the view is closer than this many candles to the first loaded one. */
const LOAD_OLDER_EDGE_CANDLES = 20;
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
  /** Account data from the backend; draws open orders, the position and fills on the chart. */
  account?: AccountSnapshot | null;
  /** Strategy SMAs to draw; null hides them. */
  movingAverages?: MovingAverageSettings | null;
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

/** Candlestick chart with a volume pane, hover crosshair, OHLC legend, live updates and account overlays. */
export function PriceChart({
  symbol,
  interval,
  theme,
  height,
  historyLimit,
  restUrl,
  streamUrl,
  onStatusChange,
  account,
  movingAverages = null,
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handlesRef = useRef<ChartHandles | null>(null);
  const colorsRef = useRef<ChartColors>(CHART_COLORS[theme]);
  const volumesRef = useRef<Map<number, number>>(new Map());
  const candlesRef = useRef<Candle[]>([]);   // loaded candles, oldest first (for the SMAs)
  const statusRef = useRef(onStatusChange);
  statusRef.current = onStatusChange;

  const [latest, setLatest] = useState<Candle | null>(null);
  const [hovered, setHovered] = useState<Candle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [candleSeries, setCandleSeries] = useState<ISeriesApi<"Candlestick"> | null>(null);
  const [firstCandleTime, setFirstCandleTime] = useState<number | null>(null);
  const [chartApi, setChartApi] = useState<IChartApi | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);

  const colors = CHART_COLORS[theme];
  useOrderLines(candleSeries, account?.open_orders, colors);
  usePositionLine(candleSeries, account?.position, latest?.close ?? null, account?.quote_asset ?? "", colors);
  useFillMarkers(candleSeries, account?.executions, interval, firstCandleTime, colors);
  useMovingAverages(chartApi, candlesRef, historyVersion, latest, movingAverages, colors);

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
    setCandleSeries(candles);
    setChartApi(chart);
    return () => {
      setCandleSeries(null);
      setChartApi(null);
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

  // Load history, then follow the live stream; load older candles when scrolled to the left edge.
  // Restarts when symbol/interval change.
  useEffect(() => {
    const handles = handlesRef.current;
    if (!handles) return;

    const controller = new AbortController();
    let ready = false; // history loaded; until then live updates are buffered
    let pending: Candle[] = [];
    let lastTime = 0;
    let loadingOlder = false;
    let reachedFirstCandle = false; // Binance has no older candles for this symbol and interval

    const showCandles = () => {
      const candles = candlesRef.current;
      handles.candles.setData(candles.map(toBar));
      handles.volume.setData(candles.map((c) => toVolumeBar(c, colorsRef.current)));
      volumesRef.current = new Map(candles.map((c) => [c.time, c.volume]));
      setFirstCandleTime(candles[0]?.time ?? null);
      setHistoryVersion((v) => v + 1);
    };

    const applyCandle = (c: Candle) => {
      if (c.time < lastTime) return; // the chart only accepts the latest candle or a newer one
      handles.candles.update(toBar(c));
      handles.volume.update(toVolumeBar(c, colorsRef.current));
      volumesRef.current.set(c.time, c.volume);
      const candles = candlesRef.current;
      if (candles.at(-1)?.time === c.time) candles[candles.length - 1] = c;
      else candles.push(c);
      lastTime = c.time;
      setLatest(c);
    };

    const loadHistory = async () => {
      ready = false;
      try {
        const history = await fetchCandles(symbol, interval, { limit: historyLimit, restUrl, signal: controller.signal });
        if (controller.signal.aborted) return;
        // After a reconnect, older candles loaded by scrolling are kept in front of the fresh ones.
        const firstFresh = history[0]?.time ?? Infinity;
        candlesRef.current = [...candlesRef.current.filter((c) => c.time < firstFresh), ...history];
        showCandles();
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

    const loadOlder = async () => {
      const first = candlesRef.current[0];
      if (!ready || loadingOlder || reachedFirstCandle || !first) return;
      loadingOlder = true;
      try {
        const older = await fetchCandles(symbol, interval, {
          limit: MAX_LIMIT,
          endTime: first.time * 1000 - 1,
          restUrl,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (older.length < MAX_LIMIT) reachedFirstCandle = true;
        const firstLoaded = candlesRef.current[0].time;
        candlesRef.current = [...older.filter((c) => c.time < firstLoaded), ...candlesRef.current];
        showCandles();
      } catch {
        // A failed page is retried on the next scroll; the candles already shown stay.
      } finally {
        loadingOlder = false;
      }
    };

    const onVisibleRangeChange = (range: LogicalRange | null) => {
      if (range && range.from < LOAD_OLDER_EDGE_CANDLES) void loadOlder();
    };
    handles.chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleRangeChange);

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
      handles.chart.timeScale().unsubscribeVisibleLogicalRangeChange(onVisibleRangeChange);
      candlesRef.current = [];
      setLatest(null);
      setFirstCandleTime(null);
    };
  }, [symbol, interval, historyLimit, restUrl, streamUrl]);

  const shown = hovered ?? latest;
  const direction = shown && shown.close >= shown.open ? "up" : "down";
  const averages =
    shown && movingAverages
      ? [
          { window: movingAverages.fast, color: colors.smaFast },
          { window: movingAverages.slow, color: colors.smaSlow },
        ].map((a) => ({ ...a, value: smaAtTime(candlesRef.current, shown.time, a.window) }))
      : [];

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
          {averages.map(({ window, color, value }) =>
            value === null ? null : (
              <span key={window}>
                SMA {window} <b style={{ color }}>{formatPrice(value)}</b>
              </span>
            ),
          )}
        </div>
      )}
      {error && <div className="btw-error">Price data unavailable: {error}</div>}
    </div>
  );
}
