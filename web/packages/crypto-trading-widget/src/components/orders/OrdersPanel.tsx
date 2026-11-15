import { useState } from "react";

import "../../styles/orders.css";
import type { AccountStreamStatus } from "../../data/useAccountStream";
import type { AccountSnapshot } from "../../types/backend";
import { ExecutionsTable } from "./ExecutionsTable";
import { OpenOrdersTable } from "./OpenOrdersTable";
import { PositionLine } from "./PositionLine";

type TabId = "open" | "history";

export interface OrdersPanelProps {
  account: AccountSnapshot | null;
  stream: AccountStreamStatus;
}

/** Panel below the chart: the position, and two tabs, Open orders and Execution history (30 days). */
export function OrdersPanel({ account, stream }: OrdersPanelProps) {
  const [tab, setTab] = useState<TabId>("open");
  const base = account?.base_asset ?? "";
  const quote = account?.quote_asset ?? "";

  const tabs: { id: TabId; label: string; count: number | null }[] = [
    { id: "open", label: "Open orders", count: account?.open_orders.length ?? null },
    { id: "history", label: "Execution history", count: account?.executions.length ?? null },
  ];

  return (
    <div className="btw-panel">
      <div className="btw-tabs" role="tablist">
        {tabs.map(({ id, label, count }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`btw-tab-${id}`}
            aria-selected={tab === id}
            aria-controls="btw-tabpanel"
            className="btw-tab"
            onClick={() => setTab(id)}
          >
            {label}
            {count !== null && <span className="btw-tab-count">{count}</span>}
          </button>
        ))}
      </div>

      <div id="btw-tabpanel" role="tabpanel" aria-labelledby={`btw-tab-${tab}`} className="btw-tabpanel">
        {!account ? (
          <div className="btw-empty">
            {stream === "reconnecting" ? "Backend unreachable. Retrying..." : "Loading..."}
          </div>
        ) : (
          <>
            <PositionLine position={account.position} base={base} quote={quote} />
            <div className="btw-table-wrap">
              {tab === "open" ? (
                <OpenOrdersTable orders={account.open_orders} base={base} quote={quote} />
              ) : (
                <ExecutionsTable executions={account.executions} base={base} quote={quote} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
