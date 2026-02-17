import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import {
  CreateOrderRequest,
  FillOrderRequest,
  Order,
  OrderStatus,
  OrderSnapshot,
  OrderSnapshotResponseApi,
  Position,
  PositionApiResponse,
  PositionStatus,
  UpdateStopRequest,
  ClosePositionRequest,
  transformOrder,
  transformCreateOrderRequest,
  transformOrderSnapshot,
  transformPosition,
  transformPositionUpdate,
  PositionUpdate,
} from './types';

interface PositionMetricsApiResponse {
  ticker: string;
  pnl: number;
  pnl_percent: number;
  r_now: number;
  entry_value: number;
  current_value: number;
  per_share_risk: number;
  total_risk: number;
}

interface PositionWithMetricsApiResponse extends PositionApiResponse {
  pnl: number;
  pnl_percent: number;
  r_now: number;
  entry_value: number;
  current_value: number;
  per_share_risk: number;
  total_risk: number;
}

interface PortfolioSummaryApiResponse {
  total_positions: number;
  total_value: number;
  total_cost_basis: number;
  total_pnl: number;
  total_pnl_percent: number;
  open_risk: number;
  open_risk_percent: number;
  account_size: number;
  available_capital: number;
  largest_position_value: number;
  largest_position_ticker: string;
  best_performer_ticker: string;
  best_performer_pnl_pct: number;
  worst_performer_ticker: string;
  worst_performer_pnl_pct: number;
  avg_r_now: number;
  positions_profitable: number;
  positions_losing: number;
  win_rate: number;
}

export interface PositionMetrics {
  ticker: string;
  pnl: number;
  pnlPercent: number;
  rNow: number;
  entryValue: number;
  currentValue: number;
  perShareRisk: number;
  totalRisk: number;
}

export interface PositionWithMetrics extends Position {
  pnl: number;
  pnlPercent: number;
  rNow: number;
  entryValue: number;
  currentValue: number;
  perShareRisk: number;
  totalRisk: number;
}

export interface PortfolioSummary {
  totalPositions: number;
  totalValue: number;
  totalCostBasis: number;
  totalPnl: number;
  totalPnlPercent: number;
  openRisk: number;
  openRiskPercent: number;
  accountSize: number;
  availableCapital: number;
  largestPositionValue: number;
  largestPositionTicker: string;
  bestPerformerTicker: string;
  bestPerformerPnlPct: number;
  worstPerformerTicker: string;
  worstPerformerPnlPct: number;
  avgRNow: number;
  positionsProfitable: number;
  positionsLosing: number;
  winRate: number;
}

export type OrderFilterStatus = OrderStatus | 'all';
export type PositionFilterStatus = PositionStatus | 'all';

export async function fetchOrders(status: OrderFilterStatus): Promise<Order[]> {
  const params = status !== 'all' ? `?status=${status}` : '';
  const response = await fetch(apiUrl(API_ENDPOINTS.orders + params));
  if (!response.ok) throw new Error('Failed to fetch orders');
  const data = await response.json();
  return data.orders.map(transformOrder);
}

export async function fetchOrderSnapshots(): Promise<{ orders: OrderSnapshot[]; asof: string }> {
  const response = await fetch(apiUrl(API_ENDPOINTS.ordersSnapshot));
  if (!response.ok) throw new Error('Failed to fetch order snapshots');
  const data: OrderSnapshotResponseApi = await response.json();
  return {
    orders: data.orders.map(transformOrderSnapshot),
    asof: data.asof,
  };
}

export async function createOrder(request: CreateOrderRequest): Promise<void> {
  const response = await fetch(apiUrl(API_ENDPOINTS.orders), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transformCreateOrderRequest(request)),
  });
  if (!response.ok) {
    let message = 'Failed to create order';
    try {
      const error = await response.json();
      if (typeof error?.detail === 'string') {
        message = error.detail;
      } else if (Array.isArray(error?.detail) && error.detail.length > 0) {
        const first = error.detail[0];
        if (typeof first?.msg === 'string') {
          message = first.msg;
        }
      }
    } catch {
      // Keep default error message if response body is not JSON.
    }
    throw new Error(message);
  }
}

export async function fillOrder(orderId: string, request: FillOrderRequest): Promise<void> {
  const payload: Record<string, number | string> = {
    filled_price: request.filledPrice,
    filled_date: request.filledDate,
  };
  if (request.stopPrice && request.stopPrice > 0) {
    payload.stop_price = request.stopPrice;
  }
  if (request.feeEur !== undefined && request.feeEur >= 0) {
    payload.fee_eur = request.feeEur;
  }
  if (request.fillFxRate !== undefined && request.fillFxRate > 0) {
    payload.fill_fx_rate = request.fillFxRate;
  }

  const response = await fetch(apiUrl(API_ENDPOINTS.orderFill(orderId)), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('Failed to fill order');
}

export async function cancelOrder(orderId: string): Promise<void> {
  const response = await fetch(apiUrl(API_ENDPOINTS.order(orderId)), {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to cancel order');
}

export async function fetchPositions(status: PositionFilterStatus): Promise<PositionWithMetrics[]> {
  const params = status !== 'all' ? `?status=${status}` : '';
  const response = await fetch(apiUrl(API_ENDPOINTS.positions + params));
  if (!response.ok) throw new Error('Failed to fetch positions');
  const data = await response.json() as { positions: PositionWithMetricsApiResponse[] };
  return data.positions.map(transformPositionWithMetrics);
}

export async function fetchPositionMetrics(positionId: string): Promise<PositionMetrics> {
  const response = await fetch(apiUrl(API_ENDPOINTS.positionMetrics(positionId)));
  if (!response.ok) throw new Error('Failed to fetch position metrics');
  const data: PositionMetricsApiResponse = await response.json();
  return transformPositionMetrics(data);
}

export async function fetchPortfolioSummary(): Promise<PortfolioSummary> {
  const response = await fetch(apiUrl(API_ENDPOINTS.portfolioSummary));
  if (!response.ok) throw new Error('Failed to fetch portfolio summary');
  const data: PortfolioSummaryApiResponse = await response.json();
  return transformPortfolioSummary(data);
}

export async function updatePositionStop(
  positionId: string,
  request: UpdateStopRequest,
): Promise<void> {
  const response = await fetch(apiUrl(API_ENDPOINTS.positionStop(positionId)), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      new_stop: request.newStop,
      reason: request.reason || '',
    }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update stop');
  }
}

export async function fetchPositionStopSuggestion(positionId: string): Promise<PositionUpdate> {
  const response = await fetch(apiUrl(API_ENDPOINTS.positionStopSuggestion(positionId)));
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch stop suggestion');
  }
  const data = await response.json();
  return transformPositionUpdate(data);
}

export async function closePosition(
  positionId: string,
  request: ClosePositionRequest,
): Promise<void> {
  const response = await fetch(apiUrl(API_ENDPOINTS.positionClose(positionId)), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      exit_price: request.exitPrice,
      reason: request.reason || '',
    }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to close position');
  }
}

function transformPositionMetrics(data: PositionMetricsApiResponse): PositionMetrics {
  return {
    ticker: data.ticker,
    pnl: data.pnl,
    pnlPercent: data.pnl_percent,
    rNow: data.r_now,
    entryValue: data.entry_value,
    currentValue: data.current_value,
    perShareRisk: data.per_share_risk,
    totalRisk: data.total_risk,
  };
}

function transformPositionWithMetrics(data: PositionWithMetricsApiResponse): PositionWithMetrics {
  return {
    ...transformPosition(data),
    pnl: data.pnl,
    pnlPercent: data.pnl_percent,
    rNow: data.r_now,
    entryValue: data.entry_value,
    currentValue: data.current_value,
    perShareRisk: data.per_share_risk,
    totalRisk: data.total_risk,
  };
}

function transformPortfolioSummary(data: PortfolioSummaryApiResponse): PortfolioSummary {
  return {
    totalPositions: data.total_positions,
    totalValue: data.total_value,
    totalCostBasis: data.total_cost_basis,
    totalPnl: data.total_pnl,
    totalPnlPercent: data.total_pnl_percent,
    openRisk: data.open_risk,
    openRiskPercent: data.open_risk_percent,
    accountSize: data.account_size,
    availableCapital: data.available_capital,
    largestPositionValue: data.largest_position_value,
    largestPositionTicker: data.largest_position_ticker,
    bestPerformerTicker: data.best_performer_ticker,
    bestPerformerPnlPct: data.best_performer_pnl_pct,
    worstPerformerTicker: data.worst_performer_ticker,
    worstPerformerPnlPct: data.worst_performer_pnl_pct,
    avgRNow: data.avg_r_now,
    positionsProfitable: data.positions_profitable,
    positionsLosing: data.positions_losing,
    winRate: data.win_rate,
  };
}
