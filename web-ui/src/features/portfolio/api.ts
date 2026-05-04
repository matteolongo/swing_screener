import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import {
  cancelOrderLocal,
  closePositionLocal,
  createOrderLocal,
  fillOrderLocal,
  getActiveStrategyLocal,
  getPositionByIdLocal,
  isLocalPersistenceMode,
  listOrdersLocal,
  listPositionsLocal,
  portfolioSummaryLocal,
  positionMetricsLocal,
  updatePositionStopLocal,
} from '@/features/persistence';
import {
  CreateOrderRequest,
  FillOrderRequest,
  Order,
  OrderStatus,
  Position,
  PositionApiResponse,
  PositionStatus,
  UpdateStopRequest,
  ClosePositionRequest,
  transformCreateOrderRequest,
  transformOrder,
  transformPosition,
  transformPositionUpdate,
  PositionUpdate,
  DegiroOrder,
  FillFromDegiroRequest,
  FillFromDegiroResponse,
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
  fees_eur: number;
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
  concentration?: ConcentrationGroupApiResponse[];
  realized_pnl?: number;
  effective_account_size?: number;
}

interface ConcentrationGroupApiResponse {
  country: string;
  risk_amount: number;
  risk_pct: number;
  position_count: number;
  warning: boolean;
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
  feesEur: number;
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
  concentration: ConcentrationGroup[];
  realizedPnl: number;
  effectiveAccountSize: number;
}

export interface ConcentrationGroup {
  country: string;
  riskAmount: number;
  riskPct: number;
  positionCount: number;
  warning: boolean;
}

interface EarningsProximityApiResponse {
  ticker: string;
  next_earnings_date?: string | null;
  days_until?: number | null;
  warning: boolean;
}

export interface EarningsProximity {
  ticker: string;
  nextEarningsDate: string | null;
  daysUntil: number | null;
  warning: boolean;
}

export interface DegiroStatusApiResponse {
  installed: boolean;
  credentials_configured: boolean;
  available: boolean;
  mode: 'ready' | 'missing_library' | 'missing_credentials';
  detail: string;
}

export interface DegiroStatus {
  installed: boolean;
  credentialsConfigured: boolean;
  available: boolean;
  mode: 'ready' | 'missing_library' | 'missing_credentials';
  detail: string;
}

export type OrderFilterStatus = OrderStatus | 'all';
export type PositionFilterStatus = PositionStatus | 'all';

async function buildApiError(response: Response, fallbackMessage: string): Promise<Error> {
  let message = fallbackMessage;
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
  return new Error(message);
}

export async function fetchOrders(status: OrderFilterStatus): Promise<Order[]> {
  if (isLocalPersistenceMode()) {
    return listOrdersLocal(status);
  }
  const params = status ? `?status=${status}` : '';
  const response = await fetch(apiUrl(`${API_ENDPOINTS.localOrders}${params}`));
  if (!response.ok) {
    throw await buildApiError(response, 'Failed to fetch orders');
  }
  const data = await response.json();
  return (data.orders ?? []).map(transformOrder);
}

export async function createOrder(request: CreateOrderRequest): Promise<void> {
  if (isLocalPersistenceMode()) {
    createOrderLocal(request);
    return;
  }
  const response = await fetch(apiUrl(API_ENDPOINTS.orders), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transformCreateOrderRequest(request)),
  });
  if (!response.ok) {
    throw await buildApiError(response, 'Failed to create order');
  }
}

export async function fillOrder(orderId: string, request: FillOrderRequest): Promise<void> {
  if (isLocalPersistenceMode()) {
    fillOrderLocal(orderId, request);
    return;
  }
  const payload: Record<string, number | string> = {
    filled_price: request.filledPrice,
    filled_date: request.filledDate,
  };
  if (request.stopPrice && request.stopPrice > 0) {
    payload.stop_price = request.stopPrice;
  }
  if (request.feeEur !== undefined) {
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
  if (!response.ok) throw await buildApiError(response, 'Failed to fill order');
}

export async function cancelOrder(orderId: string): Promise<void> {
  if (isLocalPersistenceMode()) {
    cancelOrderLocal(orderId);
    return;
  }
  const response = await fetch(apiUrl(API_ENDPOINTS.order(orderId)), {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to cancel order');
}

export async function fetchDegiroOrderHistory(): Promise<DegiroOrder[]> {
  if (isLocalPersistenceMode()) {
    return [];
  }
  const response = await fetch(apiUrl(API_ENDPOINTS.degiroOrderHistory));
  if (!response.ok) {
    throw await buildApiError(response, 'Failed to fetch DeGiro order history');
  }
  const data = await response.json();
  return (data.orders ?? []).map((o: Record<string, unknown>): DegiroOrder => ({
    orderId: String(o.order_id ?? ''),
    productId: (o.product_id as string | null) ?? null,
    isin: (o.isin as string | null) ?? null,
    productName: (o.product_name as string | null) ?? null,
    status: String(o.status ?? ''),
    price: typeof o.price === 'number' ? o.price : null,
    quantity: typeof o.quantity === 'number' ? o.quantity : 0,
    orderType: (o.order_type as string | null) ?? null,
    side: (o.side as string | null) ?? null,
    createdAt: (o.created_at as string | null) ?? null,
  }));
}

export async function fillOrderFromDegiro(
  orderId: string,
  request: FillFromDegiroRequest,
): Promise<FillFromDegiroResponse> {
  if (isLocalPersistenceMode()) {
    throw new Error('fill-from-degiro not supported in local mode');
  }
  const response = await fetch(apiUrl(API_ENDPOINTS.orderFillFromDegiro(orderId)), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ degiro_order_id: request.degiroOrderId }),
  });
  if (!response.ok) {
    throw await buildApiError(response, 'Failed to fill order from DeGiro');
  }
  const data = await response.json();
  return {
    orderId: data.order_id,
    brokerOrderId: data.broker_order_id,
    quantityMismatch: data.quantity_mismatch,
    position: data.position,
  };
}

export async function fetchPositions(status: PositionFilterStatus): Promise<PositionWithMetrics[]> {
  if (isLocalPersistenceMode()) {
    return listPositionsLocal(status);
  }
  const params = status !== 'all' ? `?status=${status}` : '';
  const response = await fetch(apiUrl(API_ENDPOINTS.positions + params));
  if (!response.ok) throw new Error('Failed to fetch positions');
  const data = await response.json() as { positions: PositionWithMetricsApiResponse[] };
  return data.positions.map(transformPositionWithMetrics);
}

export async function fetchPositionMetrics(positionId: string): Promise<PositionMetrics> {
  if (isLocalPersistenceMode()) {
    return positionMetricsLocal(positionId);
  }
  const response = await fetch(apiUrl(API_ENDPOINTS.positionMetrics(positionId)));
  if (!response.ok) throw new Error('Failed to fetch position metrics');
  const data: PositionMetricsApiResponse = await response.json();
  return transformPositionMetrics(data);
}

export async function fetchPortfolioSummary(): Promise<PortfolioSummary> {
  if (isLocalPersistenceMode()) {
    return portfolioSummaryLocal();
  }
  const response = await fetch(apiUrl(API_ENDPOINTS.portfolioSummary));
  if (!response.ok) throw new Error('Failed to fetch portfolio summary');
  const data: PortfolioSummaryApiResponse = await response.json();
  return transformPortfolioSummary(data);
}

export async function fetchEarningsProximity(ticker: string): Promise<EarningsProximity> {
  const normalizedTicker = ticker.trim().toUpperCase();
  if (!normalizedTicker || isLocalPersistenceMode()) {
    return { ticker: normalizedTicker, nextEarningsDate: null, daysUntil: null, warning: false };
  }

  const response = await fetch(apiUrl(API_ENDPOINTS.earningsProximity(normalizedTicker)));
  if (!response.ok) {
    return { ticker: normalizedTicker, nextEarningsDate: null, daysUntil: null, warning: false };
  }

  const data: EarningsProximityApiResponse = await response.json();
  return {
    ticker: data.ticker,
    nextEarningsDate: data.next_earnings_date ?? null,
    daysUntil: data.days_until ?? null,
    warning: data.warning,
  };
}

export async function updatePositionStop(
  positionId: string,
  request: UpdateStopRequest,
): Promise<void> {
  if (isLocalPersistenceMode()) {
    updatePositionStopLocal(positionId, request);
    return;
  }
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
  if (isLocalPersistenceMode()) {
    const localPosition = getPositionByIdLocal(positionId);
    if (!localPosition) {
      throw new Error(`Position not found: ${positionId}`);
    }
    const strategy = getActiveStrategyLocal();
    const response = await fetch(apiUrl(API_ENDPOINTS.positionStopSuggestionCompute), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        position: {
          ticker: localPosition.ticker,
          status: localPosition.status,
          entry_date: localPosition.entryDate,
          entry_price: localPosition.entryPrice,
          stop_price: localPosition.stopPrice,
          shares: localPosition.shares,
          position_id: localPosition.positionId ?? null,
          source_order_id: localPosition.sourceOrderId ?? null,
          initial_risk: localPosition.initialRisk ?? null,
          max_favorable_price: localPosition.maxFavorablePrice ?? null,
          exit_date: localPosition.exitDate ?? null,
          exit_price: localPosition.exitPrice ?? null,
          current_price: localPosition.currentPrice ?? null,
          notes: localPosition.notes ?? '',
          exit_order_ids: localPosition.exitOrderIds ?? null,
        },
        manage: {
          breakeven_at_r: strategy.manage.breakevenAtR,
          trail_after_r: strategy.manage.trailAfterR,
          trail_sma: strategy.manage.trailSma,
          sma_buffer_pct: strategy.manage.smaBufferPct,
          max_holding_days: strategy.manage.maxHoldingDays,
        },
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Failed to fetch stop suggestion');
    }
    const data = await response.json();
    return transformPositionUpdate(data);
  }

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
  if (isLocalPersistenceMode()) {
    closePositionLocal(positionId, request);
    return;
  }
  const response = await fetch(apiUrl(API_ENDPOINTS.positionClose(positionId)), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      exit_price: request.exitPrice,
      fee_eur: request.feeEur,
      reason: request.reason || '',
      lesson: request.lesson ?? null,
      tags: request.tags ?? [],
    }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to close position');
  }
}

export interface DegiroSyncResult {
  orders_created: number;
  orders_updated: number;
  fees_applied: number;
  ambiguous_skipped: number;
}

export async function syncDegiroOrders(): Promise<DegiroSyncResult> {
  const toDate = new Date().toISOString().split('T')[0];
  const fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const response = await fetch(apiUrl(API_ENDPOINTS.degiroOrderSyncApply), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from_date: fromDate,
      to_date: toDate,
      include_portfolio: true,
      include_orders_history: true,
      include_transactions: true,
    }),
  });
  if (!response.ok) throw await buildApiError(response, 'DeGiro sync failed');
  return response.json();
}

export async function fetchDegiroStatus(): Promise<DegiroStatus> {
  if (isLocalPersistenceMode()) {
    return {
      installed: false,
      credentialsConfigured: false,
      available: false,
      mode: 'missing_library',
      detail: 'Local persistence mode keeps broker tracking manual. DeGiro sync and audits are unavailable.',
    };
  }

  const response = await fetch(apiUrl(API_ENDPOINTS.degiroStatus));
  if (!response.ok) throw await buildApiError(response, 'Failed to fetch DeGiro status');

  const payload: DegiroStatusApiResponse = await response.json();
  return {
    installed: payload.installed,
    credentialsConfigured: payload.credentials_configured,
    available: payload.available,
    mode: payload.mode,
    detail: payload.detail,
  };
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
    feesEur: data.fees_eur ?? 0,
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
    concentration: (data.concentration ?? []).map((group) => ({
      country: group.country,
      riskAmount: group.risk_amount,
      riskPct: group.risk_pct,
      positionCount: group.position_count,
      warning: group.warning,
    })),
    realizedPnl: data.realized_pnl ?? 0,
    effectiveAccountSize: data.effective_account_size ?? data.account_size,
  };
}
