import type { ClosePositionRequest, CreateOrderRequest, FillOrderRequest, OrderStatus, Position, PositionStatus, UpdateStopRequest } from '@/features/portfolio/types';
import { transformCreateOrderRequest, transformOrder, transformPosition } from '@/features/portfolio/types';
import type { OrderApiResponse } from '@/types/order';
import type { PositionApiResponse } from '@/types/position';
import { toStrategyUpdateRequest, transformStrategy, type StrategyAPI } from '@/features/strategy/types';
import { readTradingStore, writeTradingStore } from '@/features/persistence/storage';
import type { PersistedTradingStore } from '@/features/persistence/schema';
import { fetchJson } from '@/lib/fetchJson';

export type LocalOrderFilterStatus = OrderStatus | 'all';
export type LocalPositionFilterStatus = PositionStatus | 'all';

export interface TradingSnapshotApi {
  revision: number;
  strategy: StrategyAPI;
  orders: OrderApiResponse[];
  positions: PositionApiResponse[];
}

// Serialization only: preserve nested events and all optional fee/FX/broker fields.
export function toTradingApi(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toTradingApi);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`), toTradingApi(item),
    ]));
  }
  return value;
}

function fromTradingApi(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(fromTradingApi);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase()), fromTradingApi(item),
    ]));
  }
  return value;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const isFiniteNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);
const isNullable = (value: unknown, valid: (item: unknown) => boolean) => value === null || valid(value);
const hasStrings = (value: Record<string, unknown>, keys: string[]) => keys.every(key => typeof value[key] === 'string');
const hasFiniteNumbers = (value: Record<string, unknown>, keys: string[]) => keys.every(key => isFiniteNumber(value[key]));
const isOptional = (value: unknown, valid: (item: unknown) => boolean) => value === undefined || valid(value);
const isOneOf = (value: unknown, values: readonly string[]) => typeof value === 'string' && values.includes(value);
const isOrderStatus = (value: unknown) => isOneOf(value, ['pending', 'submitted', 'filled', 'cancelled']);
const isPositionStatus = (value: unknown) => isOneOf(value, ['open', 'closed']);
const isOrderKind = (value: unknown) => isOneOf(value, ['entry', 'stop', 'take_profit']);
const isTrailMethod = (value: unknown) => isOneOf(value, ['sma20', 'atr', 'fixed_pct', 'manual']);
const isStringArray = (value: unknown) => Array.isArray(value) && value.every(item => typeof item === 'string');
const hasOptionalValues = (value: Record<string, unknown>, keys: string[], valid: (item: unknown) => boolean) => (
  keys.every(key => isOptional(value[key], valid))
);

function isStrategyIntelligenceLlm(value: unknown): boolean {
  return isRecord(value)
    && hasOptionalValues(value, ['enabled', 'enable_cache', 'enable_audit'], item => typeof item === 'boolean')
    && isOptional(value.provider, item => isOneOf(item, ['openai']))
    && hasOptionalValues(value, ['model', 'base_url', 'cache_path', 'audit_path'], item => typeof item === 'string')
    && isOptional(value.max_concurrency, isFiniteNumber);
}

function isStrategyIntelligenceCatalyst(value: unknown): boolean {
  return isRecord(value)
    && hasOptionalValues(value, ['lookback_hours', 'recency_half_life_hours', 'false_catalyst_return_z', 'min_price_reaction_atr'], isFiniteNumber)
    && isOptional(value.require_price_confirmation, item => typeof item === 'boolean');
}

function isStrategyIntelligenceTheme(value: unknown): boolean {
  return isRecord(value)
    && isOptional(value.enabled, item => typeof item === 'boolean')
    && hasOptionalValues(value, ['min_cluster_size', 'min_peer_confirmation'], isFiniteNumber)
    && isOptional(value.curated_peer_map_path, item => typeof item === 'string');
}

function isStrategyIntelligenceOpportunity(value: unknown): boolean {
  return isRecord(value)
    && hasOptionalValues(value, ['technical_weight', 'catalyst_weight', 'max_daily_opportunities', 'min_opportunity_score'], isFiniteNumber);
}

function isStrategyMarketIntelligence(value: unknown): boolean {
  return isRecord(value)
    && isOptional(value.enabled, item => typeof item === 'boolean')
    && isOptional(value.providers, isStringArray)
    && isOptional(value.universe_scope, item => isOneOf(item, ['screener_universe', 'strategy_universe']))
    && isOptional(value.market_context_symbols, isStringArray)
    && isOptional(value.llm, isStrategyIntelligenceLlm)
    && isOptional(value.catalyst, isStrategyIntelligenceCatalyst)
    && isOptional(value.theme, isStrategyIntelligenceTheme)
    && isOptional(value.opportunity, isStrategyIntelligenceOpportunity);
}

function isTradingStrategy(value: unknown): value is StrategyAPI {
  if (!isRecord(value) || !hasStrings(value, ['id', 'name', 'created_at', 'updated_at']) || typeof value.is_default !== 'boolean') return false;
  if (!isOptional(value.description, item => isNullable(item, item => typeof item === 'string')) || !isOptional(value.module, item => typeof item === 'string')) return false;
  const { universe, ranking, signals, risk, manage, market_intelligence: marketIntelligence } = value;
  if (!isRecord(universe) || !isRecord(universe.trend) || !isRecord(universe.vol) || !isRecord(universe.mom) || !isRecord(universe.filt)) return false;
  if (!hasFiniteNumbers(universe.trend, ['sma_fast', 'sma_mid', 'sma_long']) || !hasFiniteNumbers(universe.vol, ['atr_window']) || !hasFiniteNumbers(universe.mom, ['lookback_6m', 'lookback_12m']) || !hasStrings(universe.mom, ['benchmark'])) return false;
  if (!hasFiniteNumbers(universe.filt, ['min_price', 'max_price', 'max_atr_pct']) || typeof universe.filt.require_trend_ok !== 'boolean' || typeof universe.filt.require_rs_positive !== 'boolean') return false;
  if (!isOptional(universe.filt.require_weekly_uptrend, item => typeof item === 'boolean') || !isOptional(universe.filt.currencies, item => Array.isArray(item) && item.every(currency => typeof currency === 'string'))) return false;
  if (!isRecord(ranking) || !hasFiniteNumbers(ranking, ['w_mom_6m', 'w_mom_12m', 'w_rs_6m', 'top_n'])) return false;
  if (!isRecord(signals) || !hasFiniteNumbers(signals, ['breakout_lookback', 'pullback_ma', 'min_history'])) return false;
  if (!isRecord(risk) || !hasFiniteNumbers(risk, ['account_size', 'risk_pct', 'max_position_pct', 'min_shares', 'k_atr'])) return false;
  if (!isOptional(risk.min_rr, isFiniteNumber) || !isOptional(risk.rr_target, isFiniteNumber) || !isOptional(risk.commission_pct, isFiniteNumber) || !isOptional(risk.max_fee_risk_pct, isFiniteNumber) || !isOptional(risk.account_size_mode, item => isOneOf(item, ['base', 'equity'])) || !isOptional(risk.regime_enabled, item => typeof item === 'boolean') || !['regime_trend_sma', 'regime_trend_multiplier', 'regime_vol_atr_window', 'regime_vol_atr_pct_threshold', 'regime_vol_multiplier'].every(key => isOptional(risk[key], isFiniteNumber))) return false;
  if (!isRecord(manage) || !hasFiniteNumbers(manage, ['breakeven_at_r', 'trail_after_r', 'trail_sma', 'sma_buffer_pct', 'max_holding_days']) || !hasStrings(manage, ['benchmark'])) return false;
  if (!isOptional(manage.time_stop_days, isFiniteNumber) || !isOptional(manage.time_stop_min_r, isFiniteNumber)) return false;
  return marketIntelligence === undefined || isStrategyMarketIntelligence(marketIntelligence);
}

function isTradingOrder(value: unknown): value is OrderApiResponse {
  if (!isRecord(value) || !hasStrings(value, ['order_id', 'ticker', 'status', 'order_type', 'order_date', 'filled_date', 'notes']) || !hasFiniteNumbers(value, ['quantity'])) return false;
  if (!isOrderStatus(value.status)) return false;
  if (![value.limit_price, value.stop_price, value.entry_price].every(item => isNullable(item, isFiniteNumber))) return false;
  if (!isOptional(value.target_price, item => isNullable(item, isFiniteNumber))) return false;
  if (!isNullable(value.order_kind, isOrderKind) || ![value.parent_order_id, value.position_id, value.tif].every(item => isNullable(item, item => typeof item === 'string'))) return false;
  return ['fee_eur', 'fill_fx_rate'].every(key => isOptional(value[key], item => isNullable(item, isFiniteNumber)))
    && ['broker_order_id', 'broker', 'broker_synced_at'].every(key => isOptional(value[key], item => isNullable(item, item => typeof item === 'string')));
}

function isTradingPosition(value: unknown): value is PositionApiResponse {
  if (!isRecord(value) || !hasStrings(value, ['ticker', 'status', 'entry_date', 'notes']) || !hasFiniteNumbers(value, ['entry_price', 'stop_price', 'shares'])) return false;
  if (!isPositionStatus(value.status)) return false;
  if (!['position_id', 'source_order_id', 'initial_risk', 'max_favorable_price', 'exit_date', 'exit_price', 'current_price', 'exit_order_ids'].every(key => key in value)) return false;
  if (![value.position_id, value.source_order_id, value.exit_date].every(item => isNullable(item, item => typeof item === 'string')) || ![value.initial_risk, value.max_favorable_price, value.exit_price, value.current_price].every(item => isNullable(item, isFiniteNumber)) || !isNullable(value.exit_order_ids, item => Array.isArray(item) && item.every(id => typeof id === 'string'))) return false;
  if (!['target_price', 'entry_fee_eur', 'exit_fee_eur', 'exit_fx_rate', 'entry_fx_rate', 'trail_param'].every(key => isOptional(value[key], item => isNullable(item, isFiniteNumber))) || !['broker', 'broker_product_id', 'isin', 'broker_synced_at', 'thesis', 'lesson'].every(key => isOptional(value[key], item => isNullable(item, item => typeof item === 'string'))) || !isOptional(value.trail_method, item => isNullable(item, isTrailMethod)) || !isOptional(value.tags, item => isNullable(item, item => Array.isArray(item) && item.every(tag => typeof tag === 'string')))) return false;
  return isOptional(value.partial_closes, item => isNullable(item, item => Array.isArray(item) && item.every(event => isRecord(event) && hasStrings(event, ['date']) && hasFiniteNumbers(event, ['shares_closed', 'price', 'r_at_close']) && ['fee_eur', 'fx_rate'].every(key => isOptional(event[key], fee => isNullable(fee, isFiniteNumber))))));
}

function isTradingSnapshot(value: TradingSnapshotApi, expectedRevision: number): boolean {
  return value.revision === expectedRevision + 1
    && isTradingStrategy(value.strategy)
    && Array.isArray(value.orders) && value.orders.every(isTradingOrder)
    && Array.isArray(value.positions) && value.positions.every(isTradingPosition);
}

function cloneTradingValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneTradingValue);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneTradingValue(item)]));
  return value;
}

function preserveNestedExtensions<T>(typed: T, generic: unknown): T {
  if (Array.isArray(typed)) {
    const source = Array.isArray(generic) ? generic : [];
    return typed.map((item, index) => preserveNestedExtensions(item, source[index])) as T;
  }
  if (isRecord(typed)) {
    const source = isRecord(generic) ? generic : {};
    const result = cloneTradingValue(source) as Record<string, unknown>;
    for (const [key, value] of Object.entries(typed)) {
      if (value === undefined && source[key] !== undefined) continue;
      result[key] = preserveNestedExtensions(value, source[key]);
    }
    return result as T;
  }
  return typed;
}

export function tradingSnapshotLocal(store = readTradingStore()): TradingSnapshotApi {
  const strategy = store.strategies.find(item => item.id === store.activeStrategyId);
  if (!strategy) throw new Error('Active local strategy not found.');
  const serializedStrategy = preserveNestedExtensions(toStrategyUpdateRequest(strategy), toTradingApi(strategy));
  return {
    revision: store.revision ?? 0,
    strategy: { ...serializedStrategy, id: strategy.id, is_default: strategy.isDefault, created_at: strategy.createdAt, updated_at: strategy.updatedAt } as StrategyAPI,
    orders: toTradingApi(store.orders) as OrderApiResponse[],
    positions: toTradingApi(store.positions) as PositionApiResponse[],
  };
}

type CommandContext = { effective_at: string; new_position_id?: string; market_price?: unknown };
const retryContexts = new Map<string, { fingerprint: string; context: CommandContext }>();
let commandQueue: Promise<unknown> = Promise.resolve();

export function executeTradingCommandLocal(
  operation: string,
  payload: unknown,
  idempotencyKey: string = crypto.randomUUID(),
  marketPrice?: UpdateStopRequest['marketPrice'],
): Promise<void> {
  const fingerprint = JSON.stringify({ operation, payload, marketPrice });
  const execute = async () => {
    const before = readTradingStore();
    const previous = before.appliedCommands?.[idempotencyKey];
    if (previous !== undefined) {
      if (previous !== fingerprint) throw new Error('Idempotency key reused for a different request.');
      return;
    }
    const retry = retryContexts.get(idempotencyKey);
    if (retry && retry.fingerprint !== fingerprint) throw new Error('Idempotency key reused for a different request.');
    const context = retry?.context ?? {
      effective_at: new Date().toISOString(),
      ...(operation === 'fill_order' ? { new_position_id: `POS-${idempotencyKey}` } : {}),
      ...(marketPrice ? { market_price: toTradingApi(marketPrice) } : {}),
    };
    retryContexts.set(idempotencyKey, { fingerprint, context });
    const snapshot = tradingSnapshotLocal(before);
    const response = await fetchJson<TradingSnapshotApi>('/api/portfolio/state/commands', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot, expected_revision: snapshot.revision, command: { operation, payload }, context }),
      errorMessage: 'Failed to apply trading command',
    });
    if (!isTradingSnapshot(response, snapshot.revision)) {
      throw new Error('Invalid trading command snapshot.');
    }
    const current = readTradingStore();
    if (JSON.stringify(current) !== JSON.stringify(before)) throw new Error('Local trading state changed while the command was running. Retry with refreshed state.');
    const strategy = preserveNestedExtensions(transformStrategy(response.strategy), fromTradingApi(response.strategy));
    const next: PersistedTradingStore = {
      ...current, revision: response.revision,
      orders: response.orders.map(order => preserveNestedExtensions(transformOrder(order), fromTradingApi(order))),
      positions: response.positions.map(position => preserveNestedExtensions(transformPosition(position), fromTradingApi(position))),
      activeStrategyId: strategy.id,
      strategies: current.strategies.map(item => item.id === current.activeStrategyId ? strategy : item),
      appliedCommands: { ...current.appliedCommands, [idempotencyKey]: fingerprint },
    };
    writeTradingStore(next);
    retryContexts.delete(idempotencyKey);
  };
  const run = async () => {
    if (!navigator.locks) throw new Error('Browser Web Locks support is required for local trading mutations.');
    await navigator.locks.request('swing-screener.trading-command', execute);
  };
  const result = commandQueue.then(run, run);
  commandQueue = result.catch(() => undefined);
  return result;
}

export function listOrdersLocal(status: LocalOrderFilterStatus) {
  const orders = readTradingStore().orders;
  return status === 'all' ? orders : orders.filter(order => order.status === status);
}
export function getAllOrdersLocal() { return readTradingStore().orders; }
export function getAllPositionsLocal(): Position[] { return readTradingStore().positions; }
export function getPositionByIdLocal(positionId: string): Position | null {
  return readTradingStore().positions.find(position => position.positionId === positionId) ?? null;
}
export function createOrderLocal(request: CreateOrderRequest, key?: string) {
  return executeTradingCommandLocal('create_order', transformCreateOrderRequest(request), key);
}
export function fillOrderLocal(orderId: string, request: FillOrderRequest, key?: string) {
  return executeTradingCommandLocal('fill_order', { order_id: orderId, ...toTradingApi(request) as object }, key);
}
export function cancelOrderLocal(orderId: string, key?: string) {
  return executeTradingCommandLocal('cancel_order', { order_id: orderId }, key);
}
export function updatePositionStopLocal(positionId: string, request: UpdateStopRequest, key?: string) {
  if (!request.marketPrice) return Promise.reject(new Error('A current timestamped market price observation is required to update the stop.'));
  return executeTradingCommandLocal('update_stop', { position_id: positionId, new_stop: request.newStop, reason: request.reason ?? '' }, key, request.marketPrice);
}
export function closePositionLocal(positionId: string, request: ClosePositionRequest, key?: string) {
  return executeTradingCommandLocal('close_position', { position_id: positionId, ...toTradingApi(request) as object }, key);
}
