/**
 * Daily Review API client and React Query hooks
 */
import { useQuery } from '@tanstack/react-query';
import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  getActiveStrategyLocal,
  getAllOrdersLocal,
  getAllPositionsLocal,
  isLocalPersistenceMode,
  listStrategiesLocal,
} from '@/features/persistence';
import {
  DailyReview,
  DailyReviewAPI,
  transformDailyReview,
} from '@/features/dailyReview/types';
import { toStrategyUpdateRequest, type Strategy } from '@/features/strategy/types';

function toStrategyApi(strategy: Strategy) {
  return {
    id: strategy.id,
    is_default: strategy.isDefault,
    created_at: strategy.createdAt,
    updated_at: strategy.updatedAt,
    ...toStrategyUpdateRequest(strategy),
  };
}

function toPositionApi(position: ReturnType<typeof getAllPositionsLocal>[number]) {
  return {
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
  };
}

function toOrderApi(order: ReturnType<typeof getAllOrdersLocal>[number]) {
  return {
    order_id: order.orderId,
    ticker: order.ticker,
    status: order.status,
    order_type: order.orderType,
    quantity: order.quantity,
    limit_price: order.limitPrice,
    stop_price: order.stopPrice,
    order_date: order.orderDate,
    filled_date: order.filledDate,
    entry_price: order.entryPrice,
    notes: order.notes,
    order_kind: order.orderKind,
    parent_order_id: order.parentOrderId,
    position_id: order.positionId,
    tif: order.tif,
    fee_eur: order.feeEur ?? null,
    fill_fx_rate: order.fillFxRate ?? null,
  };
}

/**
 * Fetch daily review from API
 */
export async function getDailyReview(
  strategyId: string,
  topN: number = 10,
  universe?: string | null,
): Promise<DailyReview> {
  if (isLocalPersistenceMode()) {
    const strategy =
      listStrategiesLocal().find((item) => item.id === strategyId) ?? getActiveStrategyLocal();
    const positions = getAllPositionsLocal();
    const orders = getAllOrdersLocal();

    const response = await fetch(apiUrl(API_ENDPOINTS.dailyReviewCompute), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        top_n: topN,
        universe: universe?.trim() || null,
        strategy: toStrategyApi(strategy),
        positions: positions.map(toPositionApi),
        orders: orders.map(toOrderApi),
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to fetch daily review' }));
      throw new Error(error.detail || 'Failed to fetch daily review');
    }

    const data: DailyReviewAPI = await response.json();
    return transformDailyReview(data);
  }

  const params = new URLSearchParams();
  params.set('top_n', String(topN));
  params.set('strategy_id', strategyId);
  if (universe && universe.trim().length > 0) {
    params.set('universe', universe.trim());
  }
  const url = `${apiUrl(API_ENDPOINTS.dailyReview)}?${params.toString()}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch daily review' }));
    throw new Error(error.detail || 'Failed to fetch daily review');
  }
  
  const data: DailyReviewAPI = await response.json();
  return transformDailyReview(data);
}

/**
 * React Query hook for daily review
 */
export function useDailyReview(strategyId: string | null, topN: number = 10, universe?: string | null) {
  return useQuery({
    queryKey: queryKeys.dailyReview(strategyId, topN, universe),
    queryFn: () => getDailyReview(strategyId as string, topN, universe),
    enabled: Boolean(strategyId),
    staleTime: 1000 * 60 * 5, // 5 minutes - review data is relatively stable
    refetchOnWindowFocus: false, // Don't refetch on window focus - user is reviewing
  });
}
