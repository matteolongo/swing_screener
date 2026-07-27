import { useState, useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import Button from '@/components/common/Button';
import {
  findRunStartedAfter,
  useEvidenceRefreshMutation,
  useIntelligenceAnalysisMutation,
  useIntelligenceLatestQuery,
  useRunTrace,
  useTickerRuns,
} from '@/features/intelligence/hooks';
import { useSymbolCatalystQuery } from '@/features/intelligence/catalysts/hooks';
import type {
  EvidenceRefreshResponse,
  SymbolIntelligence,
} from '@/features/intelligence/types';
import SymbolBacktestTab from '@/components/domain/workspace/SymbolBacktestTab';
import SymbolFundamentalsTab from '@/components/domain/workspace/SymbolFundamentalsTab';
import SymbolIntelligenceTab from '@/components/domain/workspace/SymbolIntelligenceTab';
import SymbolOverviewTab from '@/components/domain/workspace/SymbolOverviewTab';
import VolumeZonesTab from '@/components/domain/workspace/VolumeZonesTab';
import type { SymbolAnalysisCandidate, WorkspaceAnalysisTab } from '@/components/domain/workspace/types';
import type { ScreenerResponse } from '@/features/screener/types';
import type { PositionWithMetrics } from '@/features/portfolio/api';
import { useRunScreenerMutation } from '@/features/screener/hooks';
import type { FundamentalSnapshot } from '@/features/fundamentals/types';
import type { WorkspaceSourceState } from '@/features/workspaceData/types';
import { useUnwatchSymbolMutation, useWatchlist, useWatchSymbolMutation } from '@/features/watchlist/hooks';
import { useScreenerStore } from '@/stores/screenerStore';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';

interface SymbolAnalysisContentProps {
  ticker: string;
  candidate?: SymbolAnalysisCandidate | null;
  position?: PositionWithMetrics | null;
  activeTab: WorkspaceAnalysisTab;
  onTabChange: (tab: WorkspaceAnalysisTab) => void;
  orderPanel?: ReactNode;
  intelligenceOutdated?: boolean;
  selectionVersion?: number;
  intelligenceWorkflow?: {
    sources: WorkspaceSourceState[];
  };
  fundamentals?: {
    data?: FundamentalSnapshot;
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
    error: Error | null;
    isRefreshing: boolean;
    refreshError: Error | null;
    onRefresh: () => void;
  };
}

export default function SymbolAnalysisContent({
  ticker,
  candidate,
  position = null,
  activeTab,
  onTabChange,
  orderPanel = null,
  intelligenceOutdated = false,
  selectionVersion = 0,
  intelligenceWorkflow,
  fundamentals = {
    data: undefined,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    isRefreshing: false,
    refreshError: null,
    onRefresh: () => undefined,
  },
}: SymbolAnalysisContentProps) {
  const watchlistQuery = useWatchlist();
  const watchSymbolMutation = useWatchSymbolMutation();
  const unwatchSymbolMutation = useUnwatchSymbolMutation();
  const computeAnalysisMutation = useRunScreenerMutation((result) => {
    const newCandidate = result.candidates[0];
    if (!newCandidate) return;
    const current = useScreenerStore.getState().lastResult;
    const target = newCandidate.ticker.toUpperCase();
    if (!current) {
      useScreenerStore.getState().setLastResult(result);
      return;
    }
    const exists = current.candidates.some((c) => c.ticker.toUpperCase() === target);
    const merged: ScreenerResponse = {
      ...current,
      candidates: exists
        ? current.candidates.map((c) => (c.ticker.toUpperCase() === target ? newCandidate : c))
        : [...current.candidates, newCandidate],
    };
    useScreenerStore.getState().setLastResult(merged);
  });

  const intelligenceMutation = useIntelligenceAnalysisMutation();
  const evidenceRefreshMutation = useEvidenceRefreshMutation();
  const intelligenceLatest = useIntelligenceLatestQuery(ticker, activeTab === 'overview' || activeTab === 'intelligence');
  const catalystQuery = useSymbolCatalystQuery(ticker, activeTab === 'overview');
  const [intelligenceResult, setIntelligenceResult] = useState<SymbolIntelligence | null>(null);
  const [attemptedRunId, setAttemptedRunId] = useState<string | null>(null);
  const [lastAttemptForce, setLastAttemptForce] = useState(false);
  const [refreshedEvidence, setRefreshedEvidence] =
    useState<EvidenceRefreshResponse | null>(null);
  const currentSessionRef = useRef(`${ticker.trim().toUpperCase()}:${selectionVersion}`);
  const tabsId = useId();
  const displayedIntelligence = intelligenceResult ?? intelligenceLatest.data ?? null;
  const tickerRuns = useTickerRuns(ticker, activeTab === 'intelligence');
  const traceRunId =
    attemptedRunId
    ?? (intelligenceMutation.isError ? null : displayedIntelligence?.runId);
  const runTrace = useRunTrace(
    traceRunId,
    activeTab === 'intelligence' && Boolean(traceRunId),
  );
  const isIntelligenceLoading = !intelligenceResult && intelligenceLatest.isLoading;

  useEffect(() => {
    currentSessionRef.current = `${ticker.trim().toUpperCase()}:${selectionVersion}`;
  }, [ticker, selectionVersion]);

  const handleAnalyzeWithAi = (force = false) => {
    const requestedSession = `${ticker.trim().toUpperCase()}:${selectionVersion}`;
    const requestStartedAt = Date.now();
    setAttemptedRunId(null);
    setLastAttemptForce(force);
    intelligenceMutation.mutate(
      { ticker, candidate, position, force },
      {
        onSuccess: (result) => {
          if (
            result.symbol.trim().toUpperCase() === ticker.trim().toUpperCase()
            && requestedSession === currentSessionRef.current
          ) {
            setIntelligenceResult(result);
          }
        },
        onSettled: async () => {
          const refreshedRuns = await tickerRuns.refetch();
          if (requestedSession !== currentSessionRef.current) return;
          const attemptedRun = findRunStartedAfter(
            refreshedRuns.data ?? [],
            ticker,
            requestStartedAt,
          );
          setAttemptedRunId(attemptedRun?.runId ?? null);
        },
      }
    );
  };

  const handleRefreshEvidence = () => {
    const requestedSession = `${ticker.trim().toUpperCase()}:${selectionVersion}`;
    setRefreshedEvidence(null);
    evidenceRefreshMutation.mutate(ticker, {
      onSuccess: (result) => {
        if (
          result.ticker.trim().toUpperCase() === ticker.trim().toUpperCase()
          && requestedSession === currentSessionRef.current
        ) {
          setRefreshedEvidence(result);
        }
      },
    });
  };

  useEffect(() => {
    setIntelligenceResult(null);
    setAttemptedRunId(null);
    setLastAttemptForce(false);
    setRefreshedEvidence(null);
    intelligenceMutation.reset();
    evidenceRefreshMutation.reset();
  }, [ticker, selectionVersion]);

  // Open positions are suppressed from the screener as manage-only, so a held
  // symbol has no candidate and the analysis (and AI payload) is thin. Compute
  // the live candidate once per symbol with includeHeld so the held position
  // gets the full screener-grade data.
  const autoComputedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!position || candidate) return;
    const key = ticker.trim().toUpperCase();
    if (autoComputedRef.current.has(key)) return;
    if (computeAnalysisMutation.isPending) return;
    autoComputedRef.current.add(key);
    computeAnalysisMutation.mutate({ tickers: [ticker], top: 1, includeHeld: true });
  }, [ticker, position, candidate, computeAnalysisMutation]);

  const heldMode = Boolean(position);
  const canAddOn = Boolean(
    candidate?.sameSymbol?.mode === 'ADD_ON'
      && candidate.recommendation?.workflowStatus === 'ready',
  );
  const candidateCanReviewOrder = !candidate || candidate.recommendation?.workflowStatus === 'ready';
  const canReviewOrder = heldMode ? canAddOn : candidateCanReviewOrder;

  useEffect(() => {
    if (activeTab === 'order' && !canReviewOrder) {
      onTabChange('overview');
    }
  }, [activeTab, canReviewOrder, onTabChange]);

  const tabs: Array<{ id: WorkspaceAnalysisTab; label: string }> = [
    { id: 'overview', label: t('workspacePage.panels.analysis.tabs.overview') },
    { id: 'fundamentals', label: t('workspacePage.panels.analysis.tabs.fundamentals') },
    { id: 'intelligence', label: t('workspacePage.panels.analysis.tabs.intelligence') },
    ...(canReviewOrder
      ? [{ id: 'order' as const, label: t('workspacePage.panels.analysis.tabs.order') }]
      : []),
    { id: 'backtest', label: t('workspacePage.panels.analysis.tabs.backtest') },
    { id: 'volumeZones', label: t('workspacePage.panels.analysis.tabs.volumeZones') },
  ];
  const watchedTickers = new Set((watchlistQuery.data ?? []).map((item) => item.ticker.toUpperCase()));
  const isWatched = watchedTickers.has(ticker.toUpperCase());
  const isWatchPending =
    (watchSymbolMutation.isPending &&
      watchSymbolMutation.variables?.ticker?.toUpperCase() === ticker.toUpperCase()) ||
    (unwatchSymbolMutation.isPending &&
      unwatchSymbolMutation.variables?.toUpperCase() === ticker.toUpperCase());
  const handleWatch = () => {
    watchSymbolMutation.mutate({
      ticker,
      watchPrice: candidate?.close ?? null,
      currency: candidate?.currency ?? null,
      source: 'analysis',
    });
  };
  const handleUnwatch = () => {
    unwatchSymbolMutation.mutate(ticker);
  };
  const handleAnalysisTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const lastIndex = tabs.length - 1;
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = index === lastIndex ? 0 : index + 1;
    if (event.key === 'ArrowLeft') nextIndex = index === 0 ? lastIndex : index - 1;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = lastIndex;
    if (nextIndex == null) return;

    event.preventDefault();
    onTabChange(tabs[nextIndex].id);
    document.getElementById(`${tabsId}-tab-${tabs[nextIndex].id}`)?.focus();
  };
  return (
    <>
      <div
        className="flex-shrink-0 flex w-full items-center gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1"
        role="tablist"
        aria-label={t('workspacePage.panels.analysis.title')}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`${tabsId}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`${tabsId}-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(event) => handleAnalysisTabKeyDown(event, tabs.findIndex((item) => item.id === tab.id))}
              className={cn(
                'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                isActive ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        id={`${tabsId}-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`${tabsId}-tab-${activeTab}`}
        className="flex-1 min-h-0 overflow-y-auto space-y-3"
      >
        {activeTab === 'overview' && (
          <>
            {!candidate && (
              <div className="rounded-lg border border-border bg-surface p-4 flex flex-col gap-3">
                <p className="text-sm text-muted">
                  {t('workspacePage.panels.analysis.computeAnalysis.description', { ticker })}
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => computeAnalysisMutation.mutate({ tickers: [ticker], top: 1, includeHeld: true })}
                    disabled={computeAnalysisMutation.isPending}
                  >
                    {computeAnalysisMutation.isPending
                      ? t('workspacePage.panels.analysis.computeAnalysis.runningAction')
                      : t('workspacePage.panels.analysis.computeAnalysis.runAction')}
                  </Button>
                </div>
                {computeAnalysisMutation.isError && (
                  <p className="text-sm text-danger">
                    {computeAnalysisMutation.error instanceof Error
                      ? computeAnalysisMutation.error.message
                      : t('workspacePage.panels.analysis.computeAnalysis.runError')}
                  </p>
                )}
              </div>
            )}
            <SymbolOverviewTab
              model={{
                ticker,
                candidate,
                position,
                fundamentals: {
                  data: fundamentals.data,
                  isLoading: fundamentals.isLoading,
                  isError: fundamentals.isError,
                  error: fundamentals.error,
                },
                catalyst: {
                  data: catalystQuery.data,
                  isLoading: catalystQuery.isLoading,
                  isError: catalystQuery.isError,
                  error: catalystQuery.error,
                },
                intelligenceOutdated,
                onOpenFundamentals: () => onTabChange('fundamentals'),
                onOpenIntelligence: () => onTabChange('intelligence'),
                onPrepareOrder: canReviewOrder ? () => onTabChange('order') : undefined,
                isWatched,
                isPendingWatch: isWatchPending,
                onWatch: handleWatch,
                onUnwatch: handleUnwatch,
              }}
            />
          </>
        )}

        {activeTab === 'order' ? orderPanel : null}

        {activeTab === 'backtest' && <SymbolBacktestTab ticker={ticker} />}

        {activeTab === 'volumeZones' && <VolumeZonesTab ticker={ticker} />}

        {activeTab === 'intelligence' && (
          <SymbolIntelligenceTab
            model={{
              ticker,
              selectionVersion,
              candidate,
              position,
              analysis: displayedIntelligence,
              intelligenceOutdated,
              sources: intelligenceWorkflow?.sources ?? [],
              trace:
                runTrace.data?.ticker.trim().toUpperCase() === ticker.trim().toUpperCase()
                  ? runTrace.data
                  : null,
              isLoadingAnalysis: isIntelligenceLoading,
              isCachedAnalysis:
                !intelligenceResult && intelligenceLatest.isFetchedAfterMount === false,
              isGenerating: intelligenceMutation.isPending,
              isRefreshingEvidence: evidenceRefreshMutation.isPending,
              generationError: intelligenceMutation.error,
              failedGenerationForce: lastAttemptForce,
              refreshError: evidenceRefreshMutation.error,
              refreshedEvidence,
              onRefreshEvidence: handleRefreshEvidence,
              onGenerate: handleAnalyzeWithAi,
            }}
          />
        )}

        {activeTab === 'fundamentals' && (
          <SymbolFundamentalsTab
            model={{
              ticker,
              snapshot: fundamentals.data,
              isLoading: fundamentals.isLoading,
              isRefreshing: fundamentals.isRefreshing || fundamentals.isFetching,
              error: fundamentals.refreshError ?? fundamentals.error,
              intelligenceOutdated,
              screenerFundamentalsInputAsOf: candidate?.fundamentalsAsOf ?? null,
              onRefresh: fundamentals.onRefresh,
            }}
          />
        )}

      </div>
    </>
  );
}
