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
    positionId: apiPosition.position_id || undefined,
    sourceOrderId: apiPosition.source_order_id || undefined,
    initialRisk: apiPosition.initial_risk || undefined,
    maxFavorablePrice: apiPosition.max_favorable_price || undefined,
    exitDate: apiPosition.exit_date || undefined,
    exitPrice: apiPosition.exit_price || undefined,
    notes: apiPosition.notes || '',
    exitOrderIds: apiPosition.exit_order_ids || undefined,
  };
}

// Calculate current R-multiple for open position
export function calculateRNow(position: Position, currentPrice: number): number {
  if (!position.initialRisk || position.initialRisk === 0) return 0;
  const profitLoss = (currentPrice - position.entryPrice) * position.shares;
  return profitLoss / position.initialRisk;
}

// Calculate P&L
export function calculatePnL(position: Position, currentPrice?: number): number {
  const exitOrCurrent = position.exitPrice || currentPrice || position.entryPrice;
  return (exitOrCurrent - position.entryPrice) * position.shares;
}

// Calculate P&L percentage
export function calculatePnLPercent(position: Position, currentPrice?: number): number {
  const exitOrCurrent = position.exitPrice || currentPrice || position.entryPrice;
  return ((exitOrCurrent - position.entryPrice) / position.entryPrice) * 100;
}

