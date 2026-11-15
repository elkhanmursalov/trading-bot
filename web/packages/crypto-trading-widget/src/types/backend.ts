/** Shapes sent by the backend (backend/app/schemas.py). Times are milliseconds since epoch (UTC). */

export type Side = "BUY" | "SELL";
export type BotMode = "off" | "dry_run" | "testnet";

/** An order on the book that has not fully filled yet. */
export interface OpenOrder {
  order_id: number;
  time: number;
  side: Side;
  type: string;
  price: number;
  quantity: number;
  filled: number;
  status: string;
}

/** One filled order; its fills are combined into a single row. */
export interface Execution {
  order_id: number;
  time: number;
  side: Side;
  price: number;
  quantity: number;
  amount: number;
  fee: number;
  fee_asset: string;
}

/** What the bot holds: the last order if it was a buy, else nothing. */
export interface Position {
  symbol: string;
  in_position: boolean;
  quantity: number;
  entry_price: number | null;
  entry_time: number | null;
}

/** Everything the orders panel needs; sent on connect and whenever it changes. */
export interface AccountSnapshot {
  symbol: string;
  base_asset: string;
  quote_asset: string;
  position: Position;
  open_orders: OpenOrder[];
  executions: Execution[];
  updated_at: number;
}

/** What the bot did last and when it checks next. */
export interface BotStatus {
  mode: BotMode;
  symbol: string;
  interval: string;
  last_check: number | null;
  last_message: string | null;
  last_error: string | null;
  next_check: number | null;
}
