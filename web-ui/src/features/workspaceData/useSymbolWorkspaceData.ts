import { useQueryClient } from '@tanstack/react-query';

import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import {
  useFundamentalSnapshotQuery,
  useRefreshFundamentalSnapshotMutation,
} from '@/features/fundamentals/hooks';
import { useIntelligenceLatestQuery } from '@/features/intelligence/hooks';
import { useLatestEvidenceSummaryQuery } from '@/features/intelligence/hooks';
import { ApiHttpError } from '@/lib/fetchJson';
import type { EvidenceRefreshResponse } from '@/features/intelligence/types';
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
  screenerRun?: {
    asOf: string;
    freshness: 'final_close' | 'intraday';
  } | null;
  evidenceRefresh?: EvidenceRefreshResponse | null;
  refreshEvidence?: () => void | Promise<void>;
}

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
  screenerRun = null,
  evidenceRefresh = null,
  refreshEvidence,
}: SymbolWorkspaceDataInput) {
  const queryClient = useQueryClient();
  const currentTicker = normalizedTicker(ticker) ?? '';
  const fundamentalsQuery = useFundamentalSnapshotQuery(currentTicker);
  const pricesQuery = useTickerCandles(currentTicker);
  const intelligenceQuery = useIntelligenceLatestQuery(currentTicker, Boolean(currentTicker));
  const evidenceLatestQuery = useLatestEvidenceSummaryQuery(currentTicker, Boolean(currentTicker));
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
  const evidenceLatestData =
    normalizedTicker(evidenceLatestQuery.data?.ticker) === currentTicker
      ? evidenceLatestQuery.data
      : undefined;
  const intelligenceNotGeneratedToday =
    intelligenceQuery.error instanceof ApiHttpError
    && intelligenceQuery.error.code === 'analysis_not_generated_today';
  const evidenceNotCached =
    evidenceLatestQuery.error instanceof ApiHttpError
    && evidenceLatestQuery.error.code === 'evidence_not_cached';
  const pricesData =
    normalizedTicker(pricesQuery.data?.ticker) === currentTicker
      ? pricesQuery.data
      : undefined;
  const priceHistory = pricesData?.priceHistory;
  const intelligencePhase = (() => {
    if (intelligenceNotGeneratedToday) return 'idle';
    if (intelligenceData?.dataStatus === 'stale') return 'stale';
    if (
      intelligenceData?.dataStatus === 'intraday'
      || intelligenceData?.dataStatus === 'unknown'
      || (intelligenceData?.degradedReasons?.length ?? 0) > 0
    ) return 'partial';
    return queryPhase({ ...intelligenceQuery, data: intelligenceData });
  })();
  const evidenceDiagnostic = intelligenceData?.inputsUsed?.enrichmentDiagnostics?.find(
    ({ source }) => source === 'evidence',
  );
  const positionOrdersAsOf = [
    positionsQuery.data?.snapshotAsOf,
    ordersQuery.data?.snapshotAsOf,
  ].filter((value): value is string => Boolean(value)).sort()[0] ?? null;
  const positionOrdersPhase = (() => {
    const hasData = positionsQuery.data !== undefined || ordersQuery.data !== undefined;
    if (positionsQuery.isLoading || ordersQuery.isLoading || positionsQuery.isFetching || ordersQuery.isFetching) {
      return 'loading';
    }
    if (positionsQuery.isError || ordersQuery.isError) return hasData ? 'partial' : 'failed';
    if (!hasData) return 'idle';
    if (
      positionsQuery.data?.snapshotFreshness === 'stale' ||
      ordersQuery.data?.snapshotFreshness === 'stale'
    ) return 'stale';
    if (
      positionsQuery.data?.snapshotFreshness !== 'fresh' ||
      ordersQuery.data?.snapshotFreshness !== 'fresh'
    ) return 'partial';
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
    sourceState(
      'screener',
      validCandidate && screenerRun && validCandidate.dataSourceSummary?.marketData?.provider
        ? 'fresh'
        : validCandidate ? 'partial' : 'idle',
      {
        provider: validCandidate?.dataSourceSummary?.marketData?.provider ?? null,
        dataAsOf: validCandidate?.lastBar ?? screenerRun?.asOf ?? null,
        missingInputs: [
          validCandidate && !screenerRun ? 'screenerRunMetadata' : null,
          validCandidate && !validCandidate.dataSourceSummary?.marketData?.provider
            ? 'screenerProvider'
            : null,
        ].filter((value): value is string => value !== null),
      },
    ),
    sourceState('prices', queryPhase({ ...pricesQuery, data: pricesData }), {
      provider: pricesData?.provider ?? null,
      dataAsOf: pricesData?.dataAsOf
        ?? priceHistory?.[priceHistory.length - 1]?.date
        ?? null,
      fetchedAt: pricesData?.fetchedAt ?? null,
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
    sourceState(
      'evidence',
      evidenceRefresh
        ? evidenceRefresh.status === 'failed' ? 'failed'
          : evidenceRefresh.status === 'partial' ? 'partial'
            : 'fresh'
        : evidenceLatestData
          ? evidenceLatestData.freshnessStatus
          : evidenceNotCached
            ? 'idle'
            : evidenceDiagnostic?.status === 'failed' ? 'failed'
              : evidenceLatestQuery.isError ? 'failed'
                : queryPhase(evidenceLatestQuery),
      {
        provider: evidenceRefresh?.sources.map(({ provider }) => provider).join(', ')
          || evidenceLatestData?.providers.join(', ')
          || null,
        dataAsOf: evidenceRefresh?.sources.map(({ asOf }) => asOf).sort().slice(-1)[0]
          ?? evidenceLatestData?.cachedAt
          ?? evidenceDiagnostic?.asOf
          ?? null,
        fetchedAt: evidenceRefresh?.refreshedAt
          ?? fetchedAt(evidenceLatestQuery.dataUpdatedAt)
          ?? intelligenceData?.generatedAt
          ?? null,
        missingInputs: evidenceRefresh
          ? []
          : [evidenceDiagnostic ? 'evidenceProvider' : 'evidenceDiagnostics'],
        stateReason: evidenceNotCached ? 'evidenceNotCached' : undefined,
        error: evidenceRefresh?.status === 'failed'
          || evidenceRefresh?.sources.some(({ status }) => status === 'failed')
          ? {
              message: evidenceRefresh.sources.find(({ status }) => status === 'failed')?.message
                ?? 'evidence_provider_failed',
              retryable: true,
            }
            : evidenceLatestQuery.error && !evidenceNotCached
              ? { message: evidenceLatestQuery.error.message, retryable: true }
              : evidenceDiagnostic?.status === 'failed'
            ? {
                message: evidenceDiagnostic.message ?? 'evidence_provider_failed',
                retryable: true,
              }
            : null,
      },
    ),
    sourceState(
      'intelligence',
      intelligencePhase,
      {
        provider: intelligenceData?.sources?.join(', ') || null,
        dataAsOf: intelligenceData?.generatedAt ?? null,
        fetchedAt: intelligenceData?.generatedAt ?? null,
        missingInputs: intelligenceData?.degradedReasons ?? [],
        stateReason: intelligenceNotGeneratedToday ? 'analysisNotGeneratedToday' : undefined,
        error: intelligenceQuery.error && !intelligenceNotGeneratedToday
          ? { message: intelligenceQuery.error.message, retryable: true }
          : null,
      },
    ),
    sourceState('positionOrders', positionOrdersPhase, {
      provider: 'local portfolio',
      dataAsOf: positionOrdersAsOf,
      fetchedAt: null,
      cacheOrigin:
        positionsQuery.isFetchedAfterMount === false && ordersQuery.isFetchedAfterMount === false
          ? 'memory'
          : 'network',
      missingInputs: [
        positionsQuery.data === undefined ? 'positions' : null,
        ordersQuery.data === undefined ? 'orders' : null,
        (
          positionsQuery.data !== undefined &&
          positionsQuery.data.snapshotFreshness !== 'fresh' &&
          positionsQuery.data.snapshotFreshness !== 'stale'
        ) || (
          ordersQuery.data !== undefined &&
          ordersQuery.data.snapshotFreshness !== 'fresh' &&
          ordersQuery.data.snapshotFreshness !== 'stale'
        )
          ? 'freshnessMetadata'
          : null,
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
    } else if (sourceId === 'evidence') {
      await refreshEvidence?.();
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
        pricesData?.dataAsOf
          ?? priceHistory?.[priceHistory.length - 1]?.date
          ?? null,
      ],
    ),
    refreshSource,
    refreshAllNonIntelligence,
  };
}
