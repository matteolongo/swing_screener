import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import { fetchJson } from '@/lib/fetchJson';
import type { OrderApiResponse } from '@/types/order';
import type { PositionUpdateApiResponse } from '@/types/position';
import type { OpenPositionIntelligenceSummaryAPI, OpenPositionIntelligenceSummary } from '@/features/intelligence/types';
import { transformOpenPositionIntelligence } from '@/features/intelligence/types';
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
  PartialCloseRequest,
  UpdateTrailMethodRequest,
  DegiroOrder,
  DegiroOrderApiResponse,
  FillFromDegiroRequest,
  FillFromDegiroResponse,
  FillFromDegiroResponseApi,
  transformCreateOrderRequest,
  transformDegiroOrder,
  transformFillFromDegiroRequest,
  transformFillFromDegiroResponse,
  transformOrder,
  transformPosition,
  transformPositionUpdate,
  PositionUpdate,
} from './types';

interface PositionMetricsApiResponse {
  ticker: string;
  pnl: number;
  pnl_percent: number;
  r_now: number;
  r_fx_adjusted?: number | null;
  entry_value: number;
  current_value: number;
  per_share_risk: number;
  total_risk: number;
}

interface PositionWithMetricsApiResponse extends PositionApiResponse {
  pnl: number;
  pnl_percent: number;
  r_now: number;
  r_fx_adjusted?: number | null;
  entry_value: number;
  current_value: number;
  per_share_risk: number;
  total_risk: number;
  fees_eur: number;
  days_open?: number;
  time_stop_warning?: boolean;
  price_source?: string;
  r_uses_initial_risk?: boolean;
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
  rFxAdjusted?: number | null;
  entryValue: number;
  currentValue: number;
  perShareRisk: number;
  totalRisk: number;
}

export interface PositionWithMetrics extends Position {
  pnl: number;
  pnlPercent: number;
  rNow: number;
  rFxAdjusted?: number | null;
  entryValue: number;
  currentValue: number;
  perShareRisk: number;
  totalRisk: number;
  feesEur: number;
  daysOpen: number;
  timeStopWarning: boolean;
  priceSource: 'live' | 'cached' | 'entry';
  rUsesInitialRisk: boolean;
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

export async function fetchOrders(status: OrderFilterStatus): Promise<Order[]> {
  if (isLocalPersistenceMode()) {
    return listOrdersLocal(status);
  }
  const params = status ? `?status=${status}` : '';
  const data = await fetchJson<{ orders?: OrderApiResponse[] }>(`${API_ENDPOINTS.localOrders}${params}`, {
    errorMessage: 'Failed to fetch orders',
  });
  return (data.orders ?? []).map(transformOrder);
}

export async function createOrder(request: CreateOrderRequest): Promise<void> {
  if (isLocalPersistenceMode()) {
    createOrderLocal(request);
    return;
  }
  await fetchJson<void>(API_ENDPOINTS.orders, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transformCreateOrderRequest(request)),
    errorMessage: 'Failed to create order',
  });
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

  await fetchJson<void>(API_ENDPOINTS.orderFill(orderId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    errorMessage: 'Failed to fill order',
  });
}

export async function submitOrder(orderId: string): Promise<void> {
  await fetchJson<void>(`/api/portfolio/orders/${orderId}/submit`, {
    method: 'PATCH',
    errorMessage: 'Failed to mark order submitted',
  });
}

export async function cancelOrder(orderId: string): Promise<void> {
  if (isLocalPersistenceMode()) {
    cancelOrderLocal(orderId);
    return;
  }
  await fetchJson<void>(API_ENDPOINTS.order(orderId), {
    method: 'DELETE',
    errorMessage: 'Failed to cancel order',
  });
}

export async function fetchDegiroStatus(): Promise<DegiroStatus> {
  if (isLocalPersistenceMode()) {
    return {
      installed: false,
      credentialsConfigured: false,
      available: false,
      mode: 'missing_library',
      detail: 'Local persistence mode keeps broker tracking manual. DeGiro sync is unavailable.',
    };
  }

  const payload = await fetchJson<DegiroStatusApiResponse>(API_ENDPOINTS.degiroStatus, {
    errorMessage: 'Failed to fetch DeGiro status',
  });
  return {
    installed: payload.installed,
    credentialsConfigured: payload.credentials_configured,
    available: payload.available,
    mode: payload.mode,
    detail: payload.detail,
  };
}

export async function fetchDegiroOrderHistory(): Promise<DegiroOrder[]> {
  if (isLocalPersistenceMode()) {
    return [];
  }

  const data = await fetchJson<{ orders?: DegiroOrderApiResponse[] }>(API_ENDPOINTS.degiroOrderHistory, {
    errorMessage: 'Failed to fetch DeGiro order history',
  });
  return (data.orders ?? []).map(transformDegiroOrder);
}

export async function fillOrderFromDegiro(
  orderId: string,
  request: FillFromDegiroRequest,
): Promise<FillFromDegiroResponse> {
  if (isLocalPersistenceMode()) {
    throw new Error('Fill from DeGiro is not supported in local persistence mode');
  }

  const payload = await fetchJson<FillFromDegiroResponseApi>(API_ENDPOINTS.orderFillFromDegiro(orderId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transformFillFromDegiroRequest(request)),
    errorMessage: 'Failed to fill order from DeGiro',
  });
  return transformFillFromDegiroResponse(payload);
}

export async function fetchPositions(status: PositionFilterStatus): Promise<PositionWithMetrics[]> {
  if (isLocalPersistenceMode()) {
    return listPositionsLocal(status);
  }
  const params = status !== 'all' ? `?status=${status}` : '';
  const data = await fetchJson<{ positions: PositionWithMetricsApiResponse[] }>(
    API_ENDPOINTS.positions + params,
    { errorMessage: 'Failed to fetch positions' },
  );
  return data.positions.map(transformPositionWithMetrics);
}

export async function fetchPositionMetrics(positionId: string): Promise<PositionMetrics> {
  if (isLocalPersistenceMode()) {
    return positionMetricsLocal(positionId);
  }
  const data = await fetchJson<PositionMetricsApiResponse>(API_ENDPOINTS.positionMetrics(positionId), {
    errorMessage: 'Failed to fetch position metrics',
  });
  return transformPositionMetrics(data);
}

export async function fetchPortfolioSummary(): Promise<PortfolioSummary> {
  if (isLocalPersistenceMode()) {
    return portfolioSummaryLocal();
  }
  const data = await fetchJson<PortfolioSummaryApiResponse>(API_ENDPOINTS.portfolioSummary, {
    errorMessage: 'Failed to fetch portfolio summary',
  });
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
  await fetchJson<void>(API_ENDPOINTS.positionStop(positionId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      new_stop: request.newStop,
      reason: request.reason || '',
    }),
    errorMessage: 'Failed to update stop',
  });
}

export async function fetchPositionStopSuggestion(positionId: string): Promise<PositionUpdate> {
  if (isLocalPersistenceMode()) {
    const localPosition = getPositionByIdLocal(positionId);
    if (!localPosition) {
      throw new Error(`Position not found: ${positionId}`);
    }
    const strategy = getActiveStrategyLocal();
    const data = await fetchJson<PositionUpdateApiResponse>(API_ENDPOINTS.positionStopSuggestionCompute, {
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
          time_stop_days: strategy.manage.timeStopDays,
          time_stop_min_r: strategy.manage.timeStopMinR,
        },
      }),
      errorMessage: 'Failed to fetch stop suggestion',
    });
    return transformPositionUpdate(data);
  }

  const data = await fetchJson<PositionUpdateApiResponse>(API_ENDPOINTS.positionStopSuggestion(positionId), {
    errorMessage: 'Failed to fetch stop suggestion',
  });
  return transformPositionUpdate(data);
}

export async function fetchPositionStopPreview(
  positionId: string,
  price: number | null,
): Promise<PositionUpdate> {
  const params = price != null ? `?price=${price}` : '';
  const data = await fetchJson<PositionUpdateApiResponse>(
    `${API_ENDPOINTS.positionStopPreview(positionId)}${params}`,
    { errorMessage: 'Failed to fetch stop preview' },
  );
  return transformPositionUpdate(data);
}

export async function updatePositionTrailMethod(
  positionId: string,
  request: UpdateTrailMethodRequest,
): Promise<void> {
  if (isLocalPersistenceMode()) {
    throw new Error('Trail method update is not supported in local persistence mode');
  }
  await fetchJson<void>(API_ENDPOINTS.positionTrailMethod(positionId), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trail_method: request.trailMethod,
      trail_param: request.trailParam ?? null,
    }),
    errorMessage: 'Failed to update trail method',
  });
}

export async function computePositionStopSuggestion(
  position: Position,
): Promise<PositionUpdate> {
  const raw = await fetchJson<PositionUpdateApiResponse>(API_ENDPOINTS.positionStopSuggestionCompute, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      position: {
        ticker: position.ticker,
        status: position.status,
        entry_date: position.entryDate,
        entry_price: position.entryPrice,
        stop_price: position.stopPrice,
        shares: position.shares,
        position_id: position.positionId ?? null,
        source_order_id: position.sourceOrderId ?? null,
        initial_risk: position.initialRisk ?? null,
        max_favorable_price: position.maxFavorablePrice ?? null,
        exit_date: position.exitDate ?? null,
        exit_price: position.exitPrice ?? null,
        current_price: position.currentPrice ?? null,
        notes: position.notes ?? '',
        exit_order_ids: position.exitOrderIds ?? null,
        trail_method: position.trailMethod ?? 'sma20',
        trail_param: position.trailParam ?? null,
      },
    }),
    errorMessage: 'Failed to compute stop suggestion',
  });
  return transformPositionUpdate(raw);
}

export async function closePosition(
  positionId: string,
  request: ClosePositionRequest,
): Promise<void> {
  if (isLocalPersistenceMode()) {
    closePositionLocal(positionId, request);
    return;
  }
  await fetchJson<void>(API_ENDPOINTS.positionClose(positionId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      exit_price: request.exitPrice,
      fee_eur: request.feeEur,
      reason: request.reason || '',
      lesson: request.lesson ?? null,
      tags: request.tags ?? [],
    }),
    errorMessage: 'Failed to close position',
  });
}

export async function partialClosePosition(
  positionId: string,
  request: PartialCloseRequest,
): Promise<void> {
  await fetchJson<void>(API_ENDPOINTS.positionPartialClose(positionId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      shares_closed: request.sharesClosed,
      price: request.price,
      fee_eur: request.feeEur,
    }),
    errorMessage: 'Failed to partial close position',
  });
}

function transformPositionMetrics(data: PositionMetricsApiResponse): PositionMetrics {
  return {
    ticker: data.ticker,
    pnl: data.pnl,
    pnlPercent: data.pnl_percent,
    rNow: data.r_now,
    rFxAdjusted: data.r_fx_adjusted ?? null,
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
    rFxAdjusted: data.r_fx_adjusted ?? null,
    entryValue: data.entry_value,
    currentValue: data.current_value,
    perShareRisk: data.per_share_risk,
    totalRisk: data.total_risk,
    feesEur: data.fees_eur ?? 0,
    daysOpen: data.days_open ?? 0,
    timeStopWarning: data.time_stop_warning ?? false,
    priceSource: (data.price_source as 'live' | 'cached' | 'entry') ?? 'live',
    rUsesInitialRisk: data.r_uses_initial_risk ?? false,
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

// ─── Regime breakdown ────────────────────────────────────────────────────────

export interface RegimeStats {
  regime: 'trending_up' | 'trending_down' | 'choppy';
  count: number;
  winRate: number;
  avgR: number;
  expectancy: number;
}

export interface RegimeBreakdownResponse {
  regimes: RegimeStats[];
  benchmark: string;
}

function transformRegimeStats(raw: {
  regime: string;
  count: number;
  win_rate: number;
  avg_r: number;
  expectancy: number;
}): RegimeStats {
  return {
    regime: raw.regime as RegimeStats['regime'],
    count: raw.count,
    winRate: raw.win_rate,
    avgR: raw.avg_r,
    expectancy: raw.expectancy,
  };
}

export async function fetchRegimeBreakdown(): Promise<RegimeBreakdownResponse> {
  const data = await fetchJson<{
    regimes?: Parameters<typeof transformRegimeStats>[0][];
    benchmark: string;
  }>(API_ENDPOINTS.regimeBreakdown, { errorMessage: 'Failed to fetch regime breakdown' });
  return {
    regimes: (data.regimes ?? []).map(transformRegimeStats),
    benchmark: data.benchmark,
  };
}

export async function fetchOpenPositionsIntelligence(): Promise<OpenPositionIntelligenceSummary[]> {
  const data = await fetchJson<OpenPositionIntelligenceSummaryAPI[]>(
    API_ENDPOINTS.openPositionsIntelligence,
    { errorMessage: 'Failed to fetch open positions intelligence' },
  );
  return data.map(transformOpenPositionIntelligence);
}

export async function triggerPositionAnalyze(positionId: string, force = false): Promise<void> {
  const endpoint = force
    ? `${API_ENDPOINTS.analyzePosition(positionId)}?force=true`
    : API_ENDPOINTS.analyzePosition(positionId);
  await fetchJson<void>(endpoint, {
    method: 'POST',
    errorMessage: 'Position analysis failed',
  });
}
