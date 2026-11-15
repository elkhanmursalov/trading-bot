import type { Side } from "../../types/backend";

/** Table cell with BUY in green, SELL in red. */
export function SideCell({ side }: { side: Side }) {
  return (
    <td className="btw-side" data-side={side}>
      {side}
    </td>
  );
}
