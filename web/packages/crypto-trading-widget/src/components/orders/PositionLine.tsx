import type { Position } from "../../types/backend";
import { formatPrice, formatQuantity, formatTimeUtc } from "../../utils/format";

export interface PositionLineProps {
  position: Position;
  base: string;
  quote: string;
}

/** What the bot owns right now: how much BTC, the price it paid, and since when. */
export function PositionLine({ position, base, quote }: PositionLineProps) {
  if (!position.in_position || position.entry_price === null || position.entry_time === null) {
    return <div className="btw-position">Position: none</div>;
  }
  return (
    <div className="btw-position">
      Position: <b>{`${formatQuantity(position.quantity)} ${base}`.trim()}</b>, entry{" "}
      <b>{`${formatPrice(position.entry_price)} ${quote}`.trim()}</b>
      <span className="btw-muted"> since {formatTimeUtc(position.entry_time / 1000)} UTC</span>
    </div>
  );
}
