import type { Candle, Interval, StreamStatus } from "../types/widget";

export const DEFAULT_REST_URL = "https://api.binance.com";
export const DEFAULT_STREAM_URL = "wss://stream.binance.com:9443/ws";

/** Binance returns at most 1000 candles per klines request. */
export const MAX_LIMIT = 1000;

const MAX_RECONNECT_DELAY_MS = 30_000;

/** One kline row as the REST API returns it: [openTime, open, high, low, close, volume, closeTime, ...]. */
type RawKline = [number, string, string, string, string, string, ...unknown[]];

/** Kline payload of the WebSocket stream (only the fields used here). */
interface StreamKline {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
}

function rawToCandle(row: RawKline): Candle {
  return {
    time: row[0] / 1000,
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  };
}

function streamToCandle(k: StreamKline): Candle {
  return {
    time: k.t / 1000,
    open: Number(k.o),
    high: Number(k.h),
    low: Number(k.l),
    close: Number(k.c),
    volume: Number(k.v),
  };
}

/** Latest `limit` candles, oldest first; the last one is the candle still forming. */
export async function fetchCandles(
  symbol: string,
  interval: Interval,
  limit: number,
  restUrl: string = DEFAULT_REST_URL,
  signal?: AbortSignal,
): Promise<Candle[]> {
  const url = new URL("/api/v3/klines", restUrl);
  url.searchParams.set("symbol", symbol.toUpperCase());
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(Math.min(limit, MAX_LIMIT)));

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Binance klines request failed: HTTP ${response.status}`);
  }
  const rows = (await response.json()) as RawKline[];
  return rows.map(rawToCandle);
}

export interface CandleStreamHandlers {
  /** Every price update of the current candle (several per second). */
  onCandle: (candle: Candle) => void;
  /** Connection state changes. */
  onStatus?: (status: StreamStatus) => void;
  /** Called after a reconnect, so missed candles can be reloaded. */
  onReconnected?: () => void;
}

/**
 * Live candle updates from the public Binance kline stream.
 * Reconnects automatically with growing delays (1s, 2s, 4s ... 30s).
 * Returns a function that closes the stream.
 */
export function subscribeCandles(
  symbol: string,
  interval: Interval,
  handlers: CandleStreamHandlers,
  streamUrl: string = DEFAULT_STREAM_URL,
): () => void {
  const url = `${streamUrl}/${symbol.toLowerCase()}@kline_${interval}`;
  let socket: WebSocket | null = null;
  let stopped = false;
  let attempts = 0;
  let hasConnected = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const connect = () => {
    handlers.onStatus?.(hasConnected ? "reconnecting" : "connecting");
    socket = new WebSocket(url);

    socket.onopen = () => {
      attempts = 0;
      handlers.onStatus?.("live");
      if (hasConnected) handlers.onReconnected?.();
      hasConnected = true;
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data as string) as { k?: StreamKline };
      if (message.k) handlers.onCandle(streamToCandle(message.k));
    };

    socket.onclose = () => {
      if (stopped) return;
      handlers.onStatus?.("reconnecting");
      const delay = Math.min(1000 * 2 ** attempts, MAX_RECONNECT_DELAY_MS);
      attempts += 1;
      retryTimer = setTimeout(connect, delay);
    };
  };

  connect();

  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    socket?.close();
  };
}
