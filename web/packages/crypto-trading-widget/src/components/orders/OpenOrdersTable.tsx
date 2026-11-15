import type { OpenOrder } from "../../types/backend";
import { formatPrice, formatQuantity, formatTimeUtc, withUnit } from "../../utils/format";
import { SideCell } from "./SideCell";

export interface OpenOrdersTableProps {
  orders: OpenOrder[];
  base: string;
  quote: string;
}

/** Orders still on the book, newest first. */
export function OpenOrdersTable({ orders, base, quote }: OpenOrdersTableProps) {
  if (orders.length === 0) return <div className="btw-empty">No open orders</div>;
  return (
    <table className="btw-table">
      <thead>
        <tr>
          <th>Time (UTC)</th>
          <th>Side</th>
          <th>Type</th>
          <th className="btw-num">{withUnit("Price", quote)}</th>
          <th className="btw-num">{withUnit("Quantity", base)}</th>
          <th className="btw-num">Filled</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o.order_id}>
            <td>{formatTimeUtc(o.time / 1000)}</td>
            <SideCell side={o.side} />
            <td>{o.type}</td>
            <td className="btw-num">{formatPrice(o.price)}</td>
            <td className="btw-num">{formatQuantity(o.quantity)}</td>
            <td className="btw-num">{Math.round((o.filled / o.quantity) * 100)}%</td>
            <td>{o.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
