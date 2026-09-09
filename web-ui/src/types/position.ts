// Position types

export type PositionStatus = 'open' | 'closed';

export type TrailMethod = 'sma20' | 'atr' | 'fixed_pct' | 'manual';

export interface UpdateTrailMethodRequest {
  trailMethod: TrailMethod;
  trailParam?: number | null;
}

export interface PartialCloseEvent {
  date: string;
  sharesClosed: number;
  price: number;
  rAtClose: number;
  feeEur?: number | null;
  fxRate?: number | null;
}

export interface PartialCloseRequest {
  sharesClosed: number;
  price: number;
  feeEur?: number;
  fxRate?: number;
}

export interface Position {
  ticker: string;
  status: PositionStatus;
  entryDate: string;
  entryPrice: number;
  stopPrice: number;
  targetPrice?: number;
  shares: number;
  positionId?: string;
  sourceOrderId?: string;
  initialRisk?: number;
  maxFavorablePrice?: number;
  exitDate?: string;
  exitPrice?: number;
  exitFeeEur?: number;
  entryFeeEur?: number | null;
  entryFxRate?: number | null;
  exitFxRate?: number | null;
  currentPrice?: number;  // Live price for open positions
  notes?: string;
  exitOrderIds?: string[];
  broker?: string | null;
  brokerProductId?: string | null;
  isin?: string | null;
  brokerSyncedAt?: string | null;
  thesis?: string | null;
  lesson?: string | null;
  tags?: string[];
  trailMethod?: TrailMethod;
  trailParam?: number | null;
  partialCloses?: PartialCloseEvent[];
}

export type ActionType = 'NO_ACTION' | 'MOVE_STOP_UP' | 'CLOSE_STOP_HIT' | 'CLOSE_TIME_EXIT' | 'CLOSE_EXIT_SIGNAL';

export interface PositionUpdate {
  ticker: string;
  status: PositionStatus;
  last: number;
  entry: number;
  stopOld: number;
  stopSuggested: number;
  shares: number;
  rNow: number;
  action: ActionType;
  reason: string;
  exhaustionScore?: number | null;
  exhaustionLabel?: string | null;
}

export interface PositionUpdateApiResponse {
  ticker: string;
  status: PositionStatus;
  last: number;
  entry: number;
  stop_old: number;
  stop_suggested: number;
  shares: number;
  r_now: number;
  action: ActionType;
  reason: string;
  exhaustion_score?: number | null;
  exhaustion_label?: string | null;
}

export interface UpdateStopRequest {
  newStop: number;
  reason?: string;
  marketPrice?: {
    ticker: string;
    price: number;
    observedAt: string;
    dataStatus: 'current';
  };
}

export interface ClosePositionRequest {
  exitPrice: number;
  feeEur?: number;
  exitFxRate?: number;
  reason?: string;
  lesson?: string;
  tags?: string[];
}

// Backend uses snake_case, transform to camelCase
export interface PositionApiResponse {
  ticker: string;
  status: PositionStatus;
  entry_date: string;
  entry_price: number;
  stop_price: number;
  target_price?: number | null;
  shares: number;
  position_id: string | null;
  source_order_id: string | null;
  initial_risk: number | null;
  max_favorable_price: number | null;
  entry_fee_eur?: number | null;
  exit_date: string | null;
  exit_price: number | null;
  exit_fee_eur?: number | null;
  exit_fx_rate?: number | null;
  current_price: number | null;  // Live price for open positions
  notes: string;
  exit_order_ids: string[] | null;
  broker?: string | null;
  broker_product_id?: string | null;
  isin?: string | null;
  broker_synced_at?: string | null;
  entry_fx_rate?: number | null;
  thesis?: string | null;
  lesson?: string | null;
  tags?: string[] | null;
  trail_method?: TrailMethod | null;
  trail_param?: number | null;
  partial_closes?: Array<{
    date: string;
    shares_closed: number;
    price: number;
    r_at_close: number;
    fee_eur?: number | null;
    fx_rate?: number | null;
  }> | null;
}

export function transformPosition(apiPosition: PositionApiResponse): Position {
  return {
    ticker: apiPosition.ticker,
    status: apiPosition.status,
    entryDate: apiPosition.entry_date,
    entryPrice: apiPosition.entry_price,
    stopPrice: apiPosition.stop_price,
    targetPrice: apiPosition.target_price ?? undefined,
    shares: apiPosition.shares,
    positionId: apiPosition.position_id ?? undefined,
    sourceOrderId: apiPosition.source_order_id ?? undefined,
    initialRisk: apiPosition.initial_risk ?? undefined,
    maxFavorablePrice: apiPosition.max_favorable_price ?? undefined,
    entryFeeEur: apiPosition.entry_fee_eur ?? null,
    exitDate: apiPosition.exit_date ?? undefined,
    exitPrice: apiPosition.exit_price ?? undefined,
    exitFeeEur: apiPosition.exit_fee_eur ?? undefined,
    exitFxRate: apiPosition.exit_fx_rate ?? null,
    entryFxRate: apiPosition.entry_fx_rate ?? null,
    currentPrice: apiPosition.current_price ?? undefined,
    notes: apiPosition.notes || '',
    exitOrderIds: apiPosition.exit_order_ids ?? undefined,
    broker: apiPosition.broker ?? null,
    brokerProductId: apiPosition.broker_product_id ?? null,
    isin: apiPosition.isin ?? null,
    brokerSyncedAt: apiPosition.broker_synced_at ?? null,
    thesis: apiPosition.thesis ?? null,
    lesson: apiPosition.lesson ?? null,
    tags: apiPosition.tags ?? [],
    trailMethod: (['sma20', 'atr', 'fixed_pct', 'manual'] as const).includes(apiPosition.trail_method as TrailMethod)
      ? (apiPosition.trail_method as TrailMethod)
      : 'sma20',
    trailParam: apiPosition.trail_param ?? null,
    partialCloses: (apiPosition.partial_closes ?? []).map((e) => ({
      date: e.date,
      sharesClosed: e.shares_closed,
      price: e.price,
      rAtClose: e.r_at_close,
      feeEur: e.fee_eur ?? null,
      fxRate: e.fx_rate ?? null,
    })),
  };
}

export function transformPositionUpdate(apiUpdate: PositionUpdateApiResponse): PositionUpdate {
  return {
    ticker: apiUpdate.ticker,
    status: apiUpdate.status,
    last: apiUpdate.last,
    entry: apiUpdate.entry,
    stopOld: apiUpdate.stop_old,
    stopSuggested: apiUpdate.stop_suggested,
    shares: apiUpdate.shares,
    rNow: apiUpdate.r_now,
    action: apiUpdate.action,
    reason: apiUpdate.reason,
    exhaustionScore: apiUpdate.exhaustion_score ?? null,
    exhaustionLabel: apiUpdate.exhaustion_label ?? null,
  };
}
