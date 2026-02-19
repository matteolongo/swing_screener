// Position types

export type PositionStatus = 'open' | 'closed';

export interface Position {
  ticker: string;
  status: PositionStatus;
  entryDate: string;
  entryPrice: number;
  stopPrice: number;
  shares: number;
  positionId?: string;
  sourceOrderId?: string;
  initialRisk?: number;
  maxFavorablePrice?: number;
  exitDate?: string;
  exitPrice?: number;
  currentPrice?: number;  // Live price for open positions
  notes?: string;
  exitOrderIds?: string[];
}

export type ActionType = 'NO_ACTION' | 'MOVE_STOP_UP' | 'CLOSE_STOP_HIT' | 'CLOSE_TIME_EXIT';

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
}

export interface UpdateStopRequest {
  newStop: number;
  reason?: string;
}

export interface ClosePositionRequest {
  exitPrice: number;
  reason?: string;
}

// Backend uses snake_case, transform to camelCase
export interface PositionApiResponse {
  ticker: string;
  status: PositionStatus;
  entry_date: string;
  entry_price: number;
  stop_price: number;
  shares: number;
  position_id: string | null;
  source_order_id: string | null;
  initial_risk: number | null;
  max_favorable_price: number | null;
  exit_date: string | null;
  exit_price: number | null;
  current_price: number | null;  // Live price for open positions
  notes: string;
  exit_order_ids: string[] | null;
}

export function transformPosition(apiPosition: PositionApiResponse): Position {
  return {
    ticker: apiPosition.ticker,
    status: apiPosition.status,
    entryDate: apiPosition.entry_date,
    entryPrice: apiPosition.entry_price,
    stopPrice: apiPosition.stop_price,
    shares: apiPosition.shares,
    positionId: apiPosition.position_id ?? undefined,
    sourceOrderId: apiPosition.source_order_id ?? undefined,
    initialRisk: apiPosition.initial_risk ?? undefined,
    maxFavorablePrice: apiPosition.max_favorable_price ?? undefined,
    exitDate: apiPosition.exit_date ?? undefined,
    exitPrice: apiPosition.exit_price ?? undefined,
    currentPrice: apiPosition.current_price ?? undefined,
    notes: apiPosition.notes || '',
    exitOrderIds: apiPosition.exit_order_ids ?? undefined,
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
  };
}
