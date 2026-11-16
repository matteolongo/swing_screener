import { API_ENDPOINTS } from '@/lib/api';
import { apiFetch } from '@/lib/apiFetch';
import { fetchJson } from '@/lib/fetchJson';
import { t } from '@/i18n/t';
import type { OrderApiResponse } from '@/types/order';
import type { PositionUpdateApiResponse } from '@/types/position';
import type { OpenPositionIntelligenceSummaryAPI, OpenPositionIntelligenceSummary } from '@/features/intelligence/types';
import { transformOpenPositionIntelligence } from '@/features/intelligence/types';
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
  transformCreateOrderRequest,
  transformOrder,
  transformPosition,
  transformPositionUpdate,
  PositionUpdate,
} from './types';

export interface PositionLifecycleResult {
  linkedOrderIds: string[];
  sharesRemaining?: number;
  newStop?: number;
  protectionAction?: 'adjustment' | 'cancellation';
}

interface PositionLifecycleApiResponse {
  linked_order_ids?: string[];
  shares_remaining?: number;
  new_stop?: number;
}

function transformPositionLifecycle(data: PositionLifecycleApiResponse = {}): PositionLifecycleResult {
  return {
    linkedOrderIds: data.linked_order_ids ?? [],
    ...(data.shares_remaining != null ? { sharesRemaining: data.shares_remaining } : {}),
    ...(data.new_stop != null ? { newStop: data.new_stop } : {}),
  };
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
  fx_rate_status?: FxRateStatus;
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
  analytics: PortfolioAnalyticsApiResponse;
  analytics_metadata: PortfolioAnalyticsMetadataApiResponse;
  fx_rate_status?: FxRateStatus;
}

interface PortfolioAnalyticsApiResponse {
  closed_trade_count: number;
  excluded_trade_count: number;
  win_count: number;
  loss_count: number;
  scratch_count: number;
  win_rate: number | null;
  win_rate_status: 'positive' | 'negative' | 'neutral';
  average_r: number | null;
  average_max_r: number | null;
  profit_factor: number | null;
  profit_factor_status: 'positive' | 'negative' | 'neutral';
  average_holding_days: number | null;
  max_win_streak: number;
  max_loss_streak: number;
  equity_curve: Array<{ position_id: string; ticker: string; date: string; r: number | null; max_r: number | null; holding_days: number | null; cumulative_r: number; tags: string[]; entry_price: number | null; exit_price: number | null; shares: number | null; initial_risk: number | null; thesis: string | null; notes: string; lesson: string | null }>;
  tag_breakdown: Array<{ tag: string; trade_count: number; win_count: number; loss_count: number; scratch_count: number; win_rate: number | null; average_r: number; expectancy: number }>;
  journal_tag_breakdown: Array<{ tag: string; trade_count: number; win_count: number; loss_count: number; scratch_count: number; average_r: number | null; average_max_r: number | null }>;
  insight: { verdict: 'positive' | 'developing' | 'negative'; reason: 'insufficient_history' | 'positive_edge' | 'positive_average_r' | 'low_win_rate' | 'negative_average_r' };
}

interface PortfolioAnalyticsMetadataApiResponse {
  heat_status: 'normal' | 'warning' | 'danger';
  heat_warning_pct: number;
  heat_max_pct: number;
  concentration_warning_pct: number;
  tag_min_sample_size: number;
}

interface ConcentrationGroupApiResponse {
  country: string;
  risk_amount: number;
  risk_pct: number;
  position_count: number;
  warning: boolean;
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
  priceSource: PriceSource;
  fxRateStatus: FxRateStatus;
  rUsesInitialRisk: boolean;
}

/** live: real-time quote; cached: last close or stored price; entry: no price
 *  resolved, metrics use the entry price; recorded: closed-position exit price. */
export type PriceSource = 'live' | 'cached' | 'entry' | 'recorded';
export type FxRateStatus = 'not_needed' | 'available' | 'unavailable';
export type EarningsLookupStatus = 'ok' | 'none' | 'unavailable';

const PRICE_SOURCES: readonly PriceSource[] = ['live', 'cached', 'entry', 'recorded'];

function toPriceSource(value: string | undefined): PriceSource {
  // A missing or unknown label must not be presented as a live quote.
  return PRICE_SOURCES.includes(value as PriceSource) ? (value as PriceSource) : 'cached';
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
  analytics: PortfolioAnalytics;
  analyticsMetadata: PortfolioAnalyticsMetadata;
  fxRateStatus: FxRateStatus;
}

export interface PortfolioAnalytics {
  closedTradeCount: number;
  excludedTradeCount: number;
  winCount: number;
  lossCount: number;
  scratchCount: number;
  winRate: number | null;
  winRateStatus: 'positive' | 'negative' | 'neutral';
  averageR: number | null;
  averageMaxR: number | null;
  profitFactor: number | null;
  profitFactorStatus: 'positive' | 'negative' | 'neutral';
  averageHoldingDays: number | null;
  maxWinStreak: number;
  maxLossStreak: number;
  equityCurve: Array<{ positionId: string; ticker: string; date: string; r: number | null; maxR: number | null; holdingDays: number | null; cumulativeR: number; tags: string[]; entryPrice: number | null; exitPrice: number | null; shares: number | null; initialRisk: number | null; thesis: string | null; notes: string; lesson: string | null }>;
  tagBreakdown: Array<{ tag: string; tradeCount: number; winCount: number; lossCount: number; scratchCount: number; winRate: number | null; averageR: number; expectancy: number }>;
  journalTagBreakdown: Array<{ tag: string; tradeCount: number; winCount: number; lossCount: number; scratchCount: number; averageR: number | null; averageMaxR: number | null }>;
  insight: { verdict: 'positive' | 'developing' | 'negative'; reason: 'insufficient_history' | 'positive_edge' | 'positive_average_r' | 'low_win_rate' | 'negative_average_r' };
}

export interface PortfolioAnalyticsMetadata {
  heatStatus: 'normal' | 'warning' | 'danger';
  heatWarningPct: number;
  heatMaxPct: number;
  concentrationWarningPct: number;
  tagMinSampleSize: number;
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
  status?: EarningsLookupStatus;
}

export interface EarningsProximity {
  ticker: string;
  nextEarningsDate: string | null;
  daysUntil: number | null;
  warning: boolean;
  /** unavailable means the lookup failed: earnings risk is unknown, not absent. */
  status: EarningsLookupStatus;
}

export type OrderFilterStatus = OrderStatus | 'all';
export type PositionFilterStatus = PositionStatus | 'all';
export type SnapshotFreshness = 'fresh' | 'stale' | 'unknown';
export type SnapshotCollection<T> = T[] & {
  snapshotAsOf: string | null;
  snapshotFreshness: SnapshotFreshness;
  snapshotStaleAfterDays: number | null;
};

function attachSnapshotMetadata<T>(
  items: T[],
  metadata: {
    asof?: string;
    snapshot_freshness?: 'fresh' | 'stale';
    stale_after_days?: number;
  },
): SnapshotCollection<T> {
  const snapshotFreshness: SnapshotFreshness =
    metadata.snapshot_freshness ?? 'unknown';
  return Object.assign(items, {
    snapshotAsOf: metadata.asof ?? null,
    snapshotFreshness,
    snapshotStaleAfterDays: metadata.stale_after_days ?? null,
  });
}

function createIdempotencyKey(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Secure idempotency key generation is unavailable in this browser.');
  }
  return globalThis.crypto.randomUUID();
}

function resolveIdempotencyKey(idempotencyKey?: string): string {
  return idempotencyKey ?? createIdempotencyKey();
}

export async function fetchOrders(status: OrderFilterStatus): Promise<SnapshotCollection<Order>> {
  const params = status !== 'all' ? `?status=${status}` : '';
  const data = await fetchJson<{
    orders?: OrderApiResponse[];
    asof?: string;
    snapshot_freshness?: 'fresh' | 'stale';
    stale_after_days?: number;
  }>(`${API_ENDPOINTS.localOrders}${params}`, {
    errorMessage: 'Failed to fetch orders',
  });
  return attachSnapshotMetadata((data.orders ?? []).map(transformOrder), data);
}

export async function createOrder(
  request: CreateOrderRequest,
  idempotencyKey?: string,
): Promise<void> {
  if ((request.orderKind ?? 'entry') === 'entry' && !request.saveAsDraft && !request.approvalToken) {
    throw new Error('Entry order approval token is required. Refresh the screener candidate and try again.');
  }
  await fetchJson<void>(API_ENDPOINTS.orders, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': resolveIdempotencyKey(idempotencyKey),
    },
    body: JSON.stringify(transformCreateOrderRequest(request)),
    errorMessage: 'Failed to create order',
  });
}

export async function fillOrder(
  orderId: string,
  request: FillOrderRequest,
  idempotencyKey?: string,
): Promise<PositionLifecycleResult> {
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

  const response = await fetchJson<{
    linked_order_ids?: string[];
    position?: Partial<PositionApiResponse>;
  }>(API_ENDPOINTS.orderFill(orderId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': resolveIdempotencyKey(idempotencyKey),
    },
    body: JSON.stringify(payload),
    errorMessage: 'Failed to fill order',
  });
  return {
    ...transformPositionLifecycle({
      linked_order_ids: response?.linked_order_ids,
      ...(response?.position?.status === 'open' ? { shares_remaining: response.position.shares } : {}),
    }),
    protectionAction: response?.position?.status === 'closed' ? 'cancellation' : 'adjustment',
  };
}

export async function submitOrder(orderId: string): Promise<void> {
  await fetchJson<void>(`/api/portfolio/orders/${orderId}/submit`, {
    method: 'PATCH',
    errorMessage: 'Failed to mark order submitted',
  });
}

export async function cancelOrder(orderId: string): Promise<void> {
  await fetchJson<void>(API_ENDPOINTS.order(orderId), {
    method: 'DELETE',
    errorMessage: 'Failed to cancel order',
  });
}

export async function fetchPositions(status: PositionFilterStatus): Promise<SnapshotCollection<PositionWithMetrics>> {
  const params = status !== 'all' ? `?status=${status}` : '';
  const data = await fetchJson<{
    positions: PositionWithMetricsApiResponse[];
    asof?: string;
    snapshot_freshness?: 'fresh' | 'stale';
    stale_after_days?: number;
  }>(
    API_ENDPOINTS.positions + params,
    { errorMessage: 'Failed to fetch positions' },
  );
  return attachSnapshotMetadata(data.positions.map(transformPositionWithMetrics), data);
}

export async function fetchPortfolioSummary(): Promise<PortfolioSummary> {
  const data = await fetchJson<PortfolioSummaryApiResponse>(API_ENDPOINTS.portfolioSummary, {
    errorMessage: 'Failed to fetch portfolio summary',
  });
  return transformPortfolioSummary(data);
}

export async function fetchEarningsProximity(ticker: string): Promise<EarningsProximity> {
  const normalizedTicker = ticker.trim().toUpperCase();
  if (!normalizedTicker) {
    return { ticker: normalizedTicker, nextEarningsDate: null, daysUntil: null, warning: false, status: 'none' };
  }

  const response = await apiFetch(API_ENDPOINTS.earningsProximity(normalizedTicker));
  if (!response.ok) {
    return { ticker: normalizedTicker, nextEarningsDate: null, daysUntil: null, warning: false, status: 'unavailable' };
  }

  const data: EarningsProximityApiResponse = await response.json();
  return {
    ticker: data.ticker,
    nextEarningsDate: data.next_earnings_date ?? null,
    daysUntil: data.days_until ?? null,
    warning: data.warning,
    status: data.status ?? (data.days_until != null ? 'ok' : 'none'),
  };
}

export async function updatePositionStop(
  positionId: string,
  request: UpdateStopRequest,
  idempotencyKey?: string,
): Promise<PositionLifecycleResult> {
  const response = await fetchJson<PositionLifecycleApiResponse>(API_ENDPOINTS.positionStop(positionId), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': resolveIdempotencyKey(idempotencyKey),
    },
    body: JSON.stringify({
      new_stop: request.newStop,
      expected_version: request.expectedVersion,
      reason: request.reason || '',
    }),
    errorMessage: 'Failed to update stop',
  });
  return transformPositionLifecycle(response);
}

export async function fetchPositionStopSuggestion(positionId: string): Promise<PositionUpdate> {
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
  idempotencyKey?: string,
): Promise<{ positionVersion: number }> {
  const result = await fetchJson<{ position_version: number }>(API_ENDPOINTS.positionTrailMethod(positionId), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': resolveIdempotencyKey(idempotencyKey),
    },
    body: JSON.stringify({
      trail_method: request.trailMethod,
      expected_version: request.expectedVersion,
      trail_param: request.trailParam ?? null,
    }),
    errorMessage: 'Failed to update trail method',
  });
  if (!Number.isInteger(result?.position_version) || result.position_version < 1) {
    throw new Error(t('positions.concurrency.versionUnavailable'));
  }
  return { positionVersion: result.position_version };
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
  idempotencyKey?: string,
): Promise<PositionLifecycleResult> {
  const response = await fetchJson<PositionLifecycleApiResponse>(API_ENDPOINTS.positionClose(positionId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': resolveIdempotencyKey(idempotencyKey),
    },
    body: JSON.stringify({
      exit_price: request.exitPrice,
      expected_version: request.expectedVersion,
      fee_eur: request.feeEur,
      exit_fx_rate: request.exitFxRate,
      reason: request.reason || '',
      lesson: request.lesson ?? null,
      tags: request.tags ?? [],
    }),
    errorMessage: 'Failed to close position',
  });
  return transformPositionLifecycle(response);
}

export async function partialClosePosition(
  positionId: string,
  request: PartialCloseRequest,
  idempotencyKey?: string,
): Promise<PositionLifecycleResult> {
  const response = await fetchJson<PositionLifecycleApiResponse>(API_ENDPOINTS.positionPartialClose(positionId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': resolveIdempotencyKey(idempotencyKey),
    },
    body: JSON.stringify({
      shares_closed: request.sharesClosed,
      expected_version: request.expectedVersion,
      price: request.price,
      fee_eur: request.feeEur,
      fx_rate: request.fxRate,
    }),
    errorMessage: 'Failed to partial close position',
  });
  return transformPositionLifecycle(response);
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
    priceSource: toPriceSource(data.price_source),
    fxRateStatus: data.fx_rate_status ?? 'not_needed',
    rUsesInitialRisk: data.r_uses_initial_risk ?? false,
  };
}

function transformPortfolioSummary(data: PortfolioSummaryApiResponse): PortfolioSummary {
  const analytics = data.analytics;
  const analyticsMetadata = data.analytics_metadata;
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
    analytics: {
      closedTradeCount: analytics.closed_trade_count,
      excludedTradeCount: analytics.excluded_trade_count,
      winCount: analytics.win_count,
      lossCount: analytics.loss_count,
      scratchCount: analytics.scratch_count,
      winRate: analytics.win_rate,
      winRateStatus: analytics.win_rate_status,
      averageR: analytics.average_r,
      averageMaxR: analytics.average_max_r ?? null,
      profitFactor: analytics.profit_factor,
      profitFactorStatus: analytics.profit_factor_status,
      averageHoldingDays: analytics.average_holding_days,
      maxWinStreak: analytics.max_win_streak,
      maxLossStreak: analytics.max_loss_streak,
      equityCurve: analytics.equity_curve.map(point => ({ positionId: point.position_id, ticker: point.ticker, date: point.date, r: point.r, maxR: point.max_r, holdingDays: point.holding_days, cumulativeR: point.cumulative_r, tags: point.tags ?? [], entryPrice: point.entry_price, exitPrice: point.exit_price, shares: point.shares, initialRisk: point.initial_risk, thesis: point.thesis, notes: point.notes, lesson: point.lesson })),
      tagBreakdown: analytics.tag_breakdown.map(row => ({ tag: row.tag, tradeCount: row.trade_count, winCount: row.win_count, lossCount: row.loss_count, scratchCount: row.scratch_count, winRate: row.win_rate, averageR: row.average_r, expectancy: row.expectancy })),
      journalTagBreakdown: (analytics.journal_tag_breakdown ?? []).map(row => ({ tag: row.tag, tradeCount: row.trade_count, winCount: row.win_count, lossCount: row.loss_count, scratchCount: row.scratch_count, averageR: row.average_r, averageMaxR: row.average_max_r })),
      insight: analytics.insight ?? { verdict: 'developing', reason: 'insufficient_history' },
    },
    analyticsMetadata: {
      heatStatus: analyticsMetadata.heat_status,
      heatWarningPct: analyticsMetadata.heat_warning_pct,
      heatMaxPct: analyticsMetadata.heat_max_pct,
      concentrationWarningPct: analyticsMetadata.concentration_warning_pct,
      tagMinSampleSize: analyticsMetadata.tag_min_sample_size,
    },
    fxRateStatus: data.fx_rate_status ?? 'not_needed',
  };
}

// ─── Regime breakdown ────────────────────────────────────────────────────────

export interface RegimeStats {
  regime: 'trending_up' | 'trending_down' | 'choppy';
  count: number;
  winRate: number | null;
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
  win_rate: number | null;
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
