import { useEffect, useRef } from 'react';
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
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { t } from '@/i18n/t';
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

interface TrackedQueryState {
  data: unknown;
  error: Error | null;
  isError: boolean;
  isFetching: boolean;
}

function useQueryActivity({
  ticker,
  selectionVersion,
  sourceId,
  pipelineStep,
  provider,
  query,
}: {
  ticker: string;
  selectionVersion: number;
  sourceId: WorkspaceSourceId;
  pipelineStep: string;
  provider: string | null;
  query: TrackedQueryState;
}) {
  const requestRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (!requestRef.current) return;
    useWorkspaceStore.getState().settleActivity(requestRef.current, {
      phase: 'discarded',
      finishedAt: new Date().toISOString(),
      message: t('workspacePage.data.activitySelectionChanged'),
      retryable: false,
    });
    requestRef.current = null;
  }, [pipelineStep, selectionVersion, sourceId, ticker]);

  useEffect(() => {
    if (!ticker) return;
    if (query.isFetching && requestRef.current === null) {
      const requestId = globalThis.crypto.randomUUID();
      requestRef.current = requestId;
      useWorkspaceStore.getState().beginActivity({
        requestId,
        ticker,
        selectionVersion,
        sourceId,
        phase: 'active',
        startedAt: new Date().toISOString(),
        finishedAt: null,
        provider,
        message: null,
        retryable: false,
        pipelineStep,
        announced: false,
      });
      return;
    }
    if (query.isFetching || requestRef.current === null) return;

    const requestId = requestRef.current;
    requestRef.current = null;
    const workspace = useWorkspaceStore.getState();
    const sessionChanged = workspace.selectedTicker !== ticker
      || workspace.selectionVersion !== selectionVersion;
    const phase = sessionChanged
      ? 'discarded'
      : query.isError
        ? query.data === undefined ? 'failed' : 'partial'
        : 'completed';
    workspace.settleActivity(requestId, {
      phase,
      finishedAt: new Date().toISOString(),
      provider,
      message: sessionChanged
        ? t('workspacePage.data.activitySelectionChanged')
        : query.error?.message ?? null,
      retryable: phase === 'failed' || phase === 'partial',
    });
  }, [
    pipelineStep,
    provider,
    query.data,
    query.error,
    query.isError,
    query.isFetching,
    selectionVersion,
    sourceId,
    ticker,
  ]);
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
  useQueryActivity({
    ticker: currentTicker,
    selectionVersion,
    sourceId: 'prices',
    pipelineStep: 'fetch-prices',
    provider: pricesQuery.data?.provider ?? null,
    query: pricesQuery,
  });
  useQueryActivity({
    ticker: currentTicker,
    selectionVersion,
    sourceId: 'fundamentals',
    pipelineStep: 'fetch-fundamentals',
    provider: fundamentalsQuery.data?.provider ?? null,
    query: fundamentalsQuery,
  });
  useQueryActivity({
    ticker: currentTicker,
    selectionVersion,
    sourceId: 'evidence',
    pipelineStep: 'fetch-evidence',
    provider: evidenceLatestQuery.data?.providers.join(', ') ?? null,
    query: evidenceNotCached
      ? { ...evidenceLatestQuery, error: null, isError: false }
      : evidenceLatestQuery,
  });
  useQueryActivity({
    ticker: currentTicker,
    selectionVersion,
    sourceId: 'intelligence',
    pipelineStep: 'fetch-intelligence',
    provider: intelligenceQuery.data?.sources?.join(', ') ?? null,
    query: intelligenceNotGeneratedToday
      ? { ...intelligenceQuery, error: null, isError: false }
      : intelligenceQuery,
  });
  useQueryActivity({
    ticker: currentTicker,
    selectionVersion,
    sourceId: 'positionOrders',
    pipelineStep: 'fetch-positions',
    provider: 'local portfolio',
    query: positionsQuery,
  });
  useQueryActivity({
    ticker: currentTicker,
    selectionVersion,
    sourceId: 'positionOrders',
    pipelineStep: 'fetch-orders',
    provider: 'local portfolio',
    query: ordersQuery,
  });
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
    if (sourceId === 'evidence') {
      await refreshEvidence?.();
      return;
    }

    if (sourceId === 'fundamentals') {
      const requestId = globalThis.crypto.randomUUID();
      useWorkspaceStore.getState().beginActivity({
        requestId,
        ticker: currentTicker,
        selectionVersion,
        sourceId,
        phase: 'active',
        startedAt: new Date().toISOString(),
        finishedAt: null,
        provider: sourceStates.find(({ id }) => id === sourceId)?.provider ?? null,
        message: null,
        retryable: false,
        pipelineStep: 'refresh-fundamentals',
        announced: false,
      });
      try {
        await refreshFundamentals.mutateAsync(currentTicker);
        const current = useWorkspaceStore.getState();
        const discarded = current.selectedTicker !== currentTicker
          || current.selectionVersion !== selectionVersion;
        current.settleActivity(requestId, {
          phase: discarded ? 'discarded' : 'completed',
          finishedAt: new Date().toISOString(),
          message: discarded ? t('workspacePage.data.activitySelectionChanged') : null,
        });
      } catch (error) {
        const current = useWorkspaceStore.getState();
        const discarded = current.selectedTicker !== currentTicker
          || current.selectionVersion !== selectionVersion;
        current.settleActivity(requestId, {
          phase: discarded ? 'discarded' : 'failed',
          finishedAt: new Date().toISOString(),
          message: discarded
            ? t('workspacePage.data.activitySelectionChanged')
            : error instanceof Error ? error.message : t('workspacePage.data.activityRefreshFailed'),
          retryable: !discarded,
        });
        throw error;
      }
      return;
    }
    if (sourceId === 'prices') {
      await pricesQuery.refetch({ throwOnError: true });
    } else if (sourceId === 'positionOrders') {
      await Promise.all([
        queryClient.invalidateQueries(
          { queryKey: queryKeys.positions() },
          { throwOnError: true },
        ),
        queryClient.invalidateQueries(
          { queryKey: queryKeys.orders() },
          { throwOnError: true },
        ),
      ]);
    } else if (sourceId === 'intelligence') {
      await queryClient.invalidateQueries(
        { queryKey: queryKeys.intelligence.latest(currentTicker) },
        { throwOnError: true },
      );
    }
  }

  async function refreshAllNonIntelligence(): Promise<void> {
    await Promise.all([
      refreshSource('fundamentals'),
      refreshSource('prices'),
      refreshSource('positionOrders'),
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
