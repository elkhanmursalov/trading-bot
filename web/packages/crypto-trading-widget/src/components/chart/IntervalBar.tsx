import "../../styles/chart.css";
import type { Interval } from "../../types/widget";

/** Button text per interval; days and weeks in capitals, as on most exchanges. */
const INTERVAL_LABELS: Record<Interval, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1D",
};

export interface IntervalBarProps {
  intervals: Interval[];
  selected: Interval;
  onSelect: (interval: Interval) => void;
}

/** One row of interval buttons; the selected one is highlighted. */
export function IntervalBar({ intervals, selected, onSelect }: IntervalBarProps) {
  return (
    <div className="btw-intervals" role="group" aria-label="Candle interval">
      {intervals.map((interval) => (
        <button
          key={interval}
          type="button"
          className="btw-interval-button"
          aria-pressed={interval === selected}
          onClick={() => onSelect(interval)}
        >
          {INTERVAL_LABELS[interval]}
        </button>
      ))}
    </div>
  );
}
