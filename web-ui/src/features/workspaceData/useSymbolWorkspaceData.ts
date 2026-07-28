import { useQueryClient } from '@tanstack/react-query';

import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import {
  useFundamentalSnapshotQuery,
  useRefreshFundamentalSnapshotMutation,
} from '@/features/fundamentals/hooks';
import { useIntelligenceLatestQuery } from '@/features/intelligence/hooks';
import type { PositionWithMetrics } from '@/features/portfolio/api';
import { useOpenPositions, useOrders } from '@/features/portfolio/hooks';
import { useTickerCandles } from '@/features/screener/hooks';
import { queryKeys } from '@/lib/queryKeys';
import { aggregateWorkspaceHealth, isIntelligenceOutdated } from './health';
import type {
  WorkspaceSourceId,
  WorkspaceSourcePhase,
  WorkspaceSourceState,
} from './types';

interface SymbolWorkspaceDataInput {
  ticker: string;
  selectionVersion: number;
  candidate: SymbolAnalysisCandidate | null;
  position: PositionWithMetrics | null;
}

// Position/order state is an EOD operational snapshot. React Query's default
// `isStale` only controls refetch eligibility (staleTime defaults to zero), so
// domain freshness instead expires 24 hours after the last successful observer update.
export const POSITION_ORDERS_FRESHNESS_MS = 24 * 60 * 60 * 1000;

function normalizedTicker(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized || null;
}

function fetchedAt(timestamp: number): string | null {
  return timestamp > 0 ? new Date(timestamp).toISOString() : null;
}

function queryPhase(query: {
  data: unknown;
  isError: boolean;
  isFetching: boolean;
  isLoading: boolean;
  isFetchedAfterMount?: boolean;
}): WorkspaceSourcePhase {
  if (query.isLoading || query.isFetching) return 'loading';
  if (query.isError) return query.data === undefined ? 'failed' : 'partial';
  if (query.data === undefined) return 'idle';
  return query.isFetchedAfterMount === false ? 'cached' : 'fresh';
}

export function useSymbolWorkspaceData({
  ticker,
  selectionVersion,
  candidate,
  position,
}: SymbolWorkspaceDataInput) {
  const queryClient = useQueryClient();
  const currentTicker = normalizedTicker(ticker) ?? '';
  const fundamentalsQuery = useFundamentalSnapshotQuery(currentTicker);
  const pricesQuery = useTickerCandles(currentTicker);
  const intelligenceQuery = useIntelligenceLatestQuery(currentTicker, Boolean(currentTicker));
  const refreshFundamentals = useRefreshFundamentalSnapshotMutation();
  const positionsQuery = useOpenPositions();
  const ordersQuery = useOrders('all');

  const validCandidate =
    normalizedTicker(candidate?.ticker) === currentTicker ? candidate : null;
  const validPosition =
    normalizedTicker(position?.ticker) === currentTicker ? position : null;
  const fundamentalsData =
    normalizedTicker(fundamentalsQuery.data?.symbol) === currentTicker
      ? fundamentalsQuery.data
      : undefined;
  const intelligenceData =
    normalizedTicker(intelligenceQuery.data?.symbol) === currentTicker
      ? intelligenceQuery.data
      : undefined;
  const pricesData =
    normalizedTicker(pricesQuery.data?.ticker) === currentTicker
      ? pricesQuery.data
      : undefined;
  const priceHistory = pricesData?.priceHistory;
  const positionOrdersUpdatedAt = Math.max(
    positionsQuery.dataUpdatedAt,
    ordersQuery.dataUpdatedAt,
  );
  const positionOrdersPhase = (() => {
    const hasData = positionsQuery.data !== undefined || ordersQuery.data !== undefined;
    if (positionsQuery.isLoading || ordersQuery.isLoading || positionsQuery.isFetching || ordersQuery.isFetching) {
      return 'loading';
    }
    if (positionsQuery.isError || ordersQuery.isError) return hasData ? 'partial' : 'failed';
    if (!hasData) return 'idle';
    if (
      positionOrdersUpdatedAt > 0 &&
      Date.now() - positionOrdersUpdatedAt > POSITION_ORDERS_FRESHNESS_MS
    ) return 'stale';
    if (positionsQuery.isFetchedAfterMount === false && ordersQuery.isFetchedAfterMount === false) {
      return 'cached';
    }
    return 'fresh';
  })();

  const sourceState = (
    id: WorkspaceSourceId,
    phase: WorkspaceSourcePhase,
    details: Partial<WorkspaceSourceState> = {},
  ): WorkspaceSourceState => ({
    id,
    ticker: currentTicker,
    selectionVersion,
    phase,
    provider: null,
    dataAsOf: null,
    fetchedAt: null,
    cacheOrigin: null,
    missingInputs: [],
    error: null,
    ...details,
  });

  const sourceStates: WorkspaceSourceState[] = [
    sourceState('screener', validCandidate ? 'fresh' : 'idle', {
      dataAsOf: validCandidate?.lastBar ?? null,
    }),
    sourceState('prices', queryPhase({ ...pricesQuery, data: pricesData }), {
      dataAsOf: priceHistory?.[priceHistory.length - 1]?.date ?? null,
      fetchedAt: fetchedAt(pricesQuery.dataUpdatedAt),
      error: pricesQuery.error
        ? { message: pricesQuery.error.message, retryable: true }
        : null,
    }),
    sourceState(
      'fundamentals',
      fundamentalsData?.freshnessStatus === 'stale'
        ? 'stale'
        : queryPhase({ ...fundamentalsQuery, data: fundamentalsData }),
      {
        provider: fundamentalsData?.provider ?? null,
        dataAsOf: fundamentalsData?.asofDate ?? null,
        fetchedAt: fundamentalsData?.updatedAt ?? fetchedAt(fundamentalsQuery.dataUpdatedAt),
        error: fundamentalsQuery.error
          ? { message: fundamentalsQuery.error.message, retryable: true }
          : null,
      },
    ),
    sourceState('evidence', validCandidate?.dataSourceSummary ? 'fresh' : 'idle'),
    sourceState(
      'intelligence',
      queryPhase({ ...intelligenceQuery, data: intelligenceData }),
      {
        dataAsOf: intelligenceData?.generatedAt ?? null,
        fetchedAt: fetchedAt(intelligenceQuery.dataUpdatedAt),
        error: intelligenceQuery.error
          ? { message: intelligenceQuery.error.message, retryable: true }
          : null,
      },
    ),
    sourceState('positionOrders', positionOrdersPhase, {
      provider: 'local portfolio',
      fetchedAt: fetchedAt(positionOrdersUpdatedAt),
      cacheOrigin:
        positionsQuery.isFetchedAfterMount === false && ordersQuery.isFetchedAfterMount === false
          ? 'memory'
          : 'network',
      missingInputs: [
        positionsQuery.data === undefined ? 'positions' : null,
        ordersQuery.data === undefined ? 'orders' : null,
      ].filter((value): value is string => value !== null),
      error: positionsQuery.error || ordersQuery.error
        ? {
            message: positionsQuery.error?.message ?? ordersQuery.error?.message ?? '',
            retryable: true,
          }
        : null,
    }),
  ];

  async function refreshSource(sourceId: WorkspaceSourceId): Promise<void> {
    if (sourceId === 'fundamentals') {
      await refreshFundamentals.mutateAsync(currentTicker);
    } else if (sourceId === 'prices') {
      await pricesQuery.refetch();
    } else if (sourceId === 'positionOrders') {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.positions() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.orders() }),
      ]);
    } else if (sourceId === 'intelligence') {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.intelligence.latest(currentTicker),
      });
    }
  }

  async function refreshAllNonIntelligence(): Promise<void> {
    await Promise.all([
      refreshFundamentals.mutateAsync(currentTicker),
      pricesQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: queryKeys.positions() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.orders() }),
    ]);
  }

  return {
    ticker: currentTicker,
    selectionVersion,
    candidate: validCandidate,
    position: validPosition,
    fundamentals: { ...fundamentalsQuery, data: fundamentalsData },
    fundamentalsRefreshing: refreshFundamentals.isPending,
    fundamentalsRefreshError: refreshFundamentals.error,
    prices: { ...pricesQuery, data: pricesData },
    intelligence: { ...intelligenceQuery, data: intelligenceData },
    sourceStates,
    health: aggregateWorkspaceHealth(sourceStates),
    intelligenceOutdated: isIntelligenceOutdated(
      intelligenceData?.generatedAt ?? null,
      [
        validCandidate?.lastBar ?? null,
        fundamentalsData?.updatedAt ?? null,
        pricesData ? fetchedAt(pricesQuery.dataUpdatedAt) : null,
      ],
    ),
    refreshSource,
    refreshAllNonIntelligence,
  };
}
