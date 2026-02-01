export type OrderStatus = 'pending' | 'filled' | 'cancelled';
export type OrderType = 'BUY_LIMIT' | 'BUY_STOP' | 'SKIP' | '';

export interface Order {
  order_id: string;
  ticker: string;
  status: OrderStatus;
  order_type: OrderType;
  limit_price: number | null;
  quantity: number | null;
  stop_price: number | null;
  order_date: string;
  filled_date: string;
  entry_price: number | null;
  commission?: number | null;
  notes: string;
  locked: boolean;
}

export type PositionStatus = 'open' | 'closed';

export interface Position {
  ticker: string;
  status: PositionStatus;
  entry_date: string;
  entry_price: number | null;
  stop_price: number | null;
  shares: number | null;
  notes: string;
  locked: boolean;
}

export interface DiffChange {
  [key: string]: [unknown, unknown];
}

export interface DiffItem {
  changes: DiffChange;
  order_id?: string;
  ticker?: string;
}

export interface PreviewDiff {
  diff: {
    orders: DiffItem[];
    positions: DiffItem[];
  };
  warnings: string[];
}

export interface OrdersResponse {
  asof: string | null;
  orders: Order[];
}

export interface PositionsResponse {
  asof: string | null;
  positions: Position[];
}

export interface ScreeningResponse {
  rows: Record<string, unknown>[];
  columns: string[];
  csv: string;
}

export interface UniversesResponse {
  universes: string[];
}

export interface OrderPatch {
  order_id: string;
  status?: OrderStatus;
  order_type?: OrderType;
  limit_price?: number | null;
  quantity?: number | null;
  stop_price?: number | null;
  order_date?: string;
  filled_date?: string;
  entry_price?: number | null;
  commission?: number | null;
  notes?: string;
  locked?: boolean;
}

export interface PositionPatch {
  ticker: string;
  status?: PositionStatus;
  stop_price?: number | null;
  locked?: boolean;
}

export interface PreviewRequest {
  orders: OrderPatch[];
  positions: PositionPatch[];
}

export interface ScreeningRequest {
  universe?: string;
  top_n?: number;
  account_size?: number;
  risk_pct?: number;
  k_atr?: number;
  max_position_pct?: number;
  use_cache?: boolean;
  force_refresh?: boolean;
  min_price?: number;
  max_price?: number;
  max_atr_pct?: number;
  require_trend_ok?: boolean;
}
