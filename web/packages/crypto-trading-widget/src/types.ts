/** Candle intervals supported by the Binance klines API and stream. */
export type Interval = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d";

/** Colour scheme the widget is drawn in. */
export type ResolvedTheme = "light" | "dark";

/** Colour scheme prop; "auto" follows the computer's light/dark setting. */
export type Theme = ResolvedTheme | "auto";

/** Connection state of the live price stream. */
export type StreamStatus = "connecting" | "live" | "reconnecting";

/** One candle; `time` is the open time in seconds since epoch (UTC). */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
