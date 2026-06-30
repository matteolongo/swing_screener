/**
 * Daily Review API client and React Query hooks
 */
import { useQuery } from '@tanstack/react-query';
import { API_ENDPOINTS } from '@/lib/api';
import { fetchJson } from '@/lib/fetchJson';
import { queryKeys } from '@/lib/queryKeys';
import { toTaxonomyFilterPayload, type TaxonomyFilterValues } from '@/features/pool/types';
import {
  getActiveStrategyLocal,
  getAllOrdersLocal,
  getAllPositionsLocal,
  isLocalPersistenceMode,
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
 * Daily-review selection mirroring the screener's taxonomy filter / preset.
 */
export interface DailyReviewSelection {
  presetId?: string | null;
  taxonomyFilter?: TaxonomyFilterValues | null;
}

function hasTaxonomyValues(filter?: TaxonomyFilterValues | null): boolean {
  return Boolean(filter && Object.values(filter).some((v) => v && v.length));
}

/** Stable cache-key fragment for a daily-review selection. */
export function dailyReviewSelectionKey(selection?: DailyReviewSelection): string {
  if (!selection) return '';
  const preset = selection.presetId ?? '';
  const filter = hasTaxonomyValues(selection.taxonomyFilter)
    ? JSON.stringify(selection.taxonomyFilter)
    : '';
  return `${preset}|${filter}`;
}

/**
 * Fetch daily review from API
 */
export async function getDailyReview(
  topN: number = 200,
  selection?: DailyReviewSelection,
): Promise<DailyReview> {
  const preset = selection?.presetId?.trim() || null;
  const taxonomyFilter = hasTaxonomyValues(selection?.taxonomyFilter)
    ? selection!.taxonomyFilter!
    : null;

  if (isLocalPersistenceMode()) {
    const strategy = getActiveStrategyLocal();
    const positions = getAllPositionsLocal();
    const orders = getAllOrdersLocal();

    const data = await fetchJson<DailyReviewAPI>(API_ENDPOINTS.dailyReviewCompute, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        top_n: topN,
        preset,
        taxonomy_filter: taxonomyFilter && toTaxonomyFilterPayload(taxonomyFilter),
        strategy: toStrategyApi(strategy),
        positions: positions.map(toPositionApi),
        orders: orders.map(toOrderApi),
      }),
      errorMessage: 'Failed to fetch daily review',
    });
    return transformDailyReview(data);
  }

  const params = new URLSearchParams();
  params.set('top_n', String(topN));
  if (preset) {
    params.set('preset', preset);
  }
  if (taxonomyFilter) {
    params.set('taxonomy_filter', JSON.stringify(toTaxonomyFilterPayload(taxonomyFilter)));
  }
  const data = await fetchJson<DailyReviewAPI>(
    `${API_ENDPOINTS.dailyReview}?${params.toString()}`,
    { errorMessage: 'Failed to fetch daily review' },
  );
  return transformDailyReview(data);
}

/**
 * React Query hook for daily review
 */
export function useDailyReview(topN: number = 200, selection?: DailyReviewSelection) {
  return useQuery({
    queryKey: queryKeys.dailyReview(topN, dailyReviewSelectionKey(selection)),
    queryFn: () => getDailyReview(topN, selection),
    staleTime: 1000 * 60 * 5, // 5 minutes - review data is relatively stable
    refetchOnWindowFocus: false, // Don't refetch on window focus - user is reviewing
  });
}
