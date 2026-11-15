import type { Execution } from "../../types/backend";
import { formatAssetAmount, formatPrice, formatQuantity, formatTimeUtc, withUnit } from "../../utils/format";
import { SideCell } from "./SideCell";

export interface ExecutionsTableProps {
  executions: Execution[];
  base: string;
  quote: string;
}

/** Filled orders of the last 30 days, newest first. */
export function ExecutionsTable({ executions, base, quote }: ExecutionsTableProps) {
  if (executions.length === 0) return <div className="btw-empty">No executions in the last 30 days</div>;
  return (
    <table className="btw-table">
      <thead>
        <tr>
          <th>Time (UTC)</th>
          <th>Side</th>
          <th className="btw-num">{withUnit("Price", quote)}</th>
          <th className="btw-num">{withUnit("Quantity", base)}</th>
          <th className="btw-num">{withUnit("Amount", quote)}</th>
          <th className="btw-num">Fee</th>
        </tr>
      </thead>
      <tbody>
        {executions.map((e) => (
          <tr key={e.order_id}>
            <td>{formatTimeUtc(e.time / 1000)}</td>
            <SideCell side={e.side} />
            <td className="btw-num">{formatPrice(e.price)}</td>
            <td className="btw-num">{formatQuantity(e.quantity)}</td>
            <td className="btw-num">{formatPrice(e.amount)}</td>
            <td className="btw-num">{formatAssetAmount(e.fee, e.fee_asset)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
