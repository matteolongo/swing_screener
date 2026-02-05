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
