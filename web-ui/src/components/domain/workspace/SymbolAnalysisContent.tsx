import { useState, useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import Button from '@/components/common/Button';
import AgentTracePanel from '@/components/domain/workspace/AgentTracePanel';
import { useIntelligenceAnalysisMutation, useIntelligenceLatestQuery } from '@/features/intelligence/hooks';
import { useSymbolCatalystQuery } from '@/features/intelligence/catalysts/hooks';
import type { SymbolIntelligence } from '@/features/intelligence/types';
import FundamentalsSnapshotCard from '@/components/domain/fundamentals/FundamentalsSnapshotCard';
import IntelligenceChatPanel from '@/components/domain/workspace/IntelligenceChatPanel';
import IntelligenceDecisionBrief from '@/components/domain/workspace/IntelligenceDecisionBrief';
import NarrativeAnalysisCard from '@/components/domain/workspace/NarrativeAnalysisCard';
import PositionReviewPanel from '@/components/domain/workspace/PositionReviewPanel';
import StrategicReviewPanel from '@/components/domain/workspace/StrategicReviewPanel';
import SymbolBacktestTab from '@/components/domain/workspace/SymbolBacktestTab';
import SymbolOverviewTab from '@/components/domain/workspace/SymbolOverviewTab';
import VolumeZonesTab from '@/components/domain/workspace/VolumeZonesTab';
import type { SymbolAnalysisCandidate, WorkspaceAnalysisTab } from '@/components/domain/workspace/types';
import type { ScreenerResponse } from '@/features/screener/types';
import type { PositionWithMetrics } from '@/features/portfolio/api';
import { useRunScreenerMutation } from '@/features/screener/hooks';
import {
  useFundamentalSnapshotQuery,
  useRefreshFundamentalSnapshotMutation,
} from '@/features/fundamentals/hooks';
import { useUnwatchSymbolMutation, useWatchlist, useWatchSymbolMutation } from '@/features/watchlist/hooks';
import { useScreenerStore } from '@/stores/screenerStore';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/formatters';

interface SymbolAnalysisContentProps {
  ticker: string;
  candidate?: SymbolAnalysisCandidate | null;
  position?: PositionWithMetrics | null;
  activeTab: WorkspaceAnalysisTab;
  onTabChange: (tab: WorkspaceAnalysisTab) => void;
  orderPanel?: ReactNode;
  intelligenceOutdated?: boolean;
}

function provenanceLegendItems() {
  return [
    { label: 'Live price', detail: 'multiple or ratio that moves with the stock price' },
    { label: 'Reported', detail: 'point-in-time value from the latest data snapshot' },
    { label: 'Latest FY / quarter', detail: 'value from a specific reported statement period' },
  ];
}

export default function SymbolAnalysisContent({
  ticker,
  candidate,
  position = null,
  activeTab,
  onTabChange,
  orderPanel = null,
  intelligenceOutdated = false,
}: SymbolAnalysisContentProps) {
  const watchlistQuery = useWatchlist();
  const watchSymbolMutation = useWatchSymbolMutation();
  const unwatchSymbolMutation = useUnwatchSymbolMutation();
  const fundamentalsQuery = useFundamentalSnapshotQuery(
    activeTab === 'fundamentals' || activeTab === 'overview' ? ticker : undefined
  );
  const refreshFundamentalsMutation = useRefreshFundamentalSnapshotMutation();
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
  const intelligenceLatest = useIntelligenceLatestQuery(ticker, activeTab === 'overview' || activeTab === 'intelligence');
  const catalystQuery = useSymbolCatalystQuery(ticker, activeTab === 'overview');
  const [intelligenceResult, setIntelligenceResult] = useState<SymbolIntelligence | null>(null);
  const currentTickerRef = useRef(ticker.toUpperCase());
  const tabsId = useId();
  const displayedIntelligence = intelligenceResult ?? intelligenceLatest.data ?? null;
  const isIntelligenceLoading = !intelligenceResult && intelligenceLatest.isLoading;
  const hasNarrative = Boolean(!isIntelligenceLoading && displayedIntelligence?.narrative?.trim());

  useEffect(() => {
    currentTickerRef.current = ticker.toUpperCase();
  }, [ticker]);

  const handleAnalyzeWithAi = (force = false) => {
    intelligenceMutation.mutate(
      { ticker, candidate, position, force },
      {
        onSuccess: (result) => {
          if (result.symbol.toUpperCase() === currentTickerRef.current) {
            setIntelligenceResult(result);
          }
        },
      }
    );
  };

  const renderAnalyzePrompt = (description: string, showButton: boolean) => (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {t('workspacePage.panels.analysis.intelligence.overviewPromptTitle')}
          </p>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        {showButton && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={intelligenceMutation.isPending}
            onClick={() => handleAnalyzeWithAi(false)}
          >
            {intelligenceMutation.isPending
              ? t('workspacePage.panels.analysis.intelligence.analyzingAction')
              : t('workspacePage.panels.analysis.intelligence.analyzeAction')}
          </Button>
        )}
      </div>
      {intelligenceMutation.isError && (
        <p className="mt-2 text-sm text-danger">
          {intelligenceMutation.error instanceof Error
            ? intelligenceMutation.error.message
            : t('workspacePage.panels.analysis.intelligence.analyzeError')}
        </p>
      )}
    </div>
  );

  useEffect(() => {
    setIntelligenceResult(null);
    intelligenceMutation.reset();
  }, [ticker]);

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
                  data: fundamentalsQuery.data,
                  isLoading: fundamentalsQuery.isLoading,
                  isError: fundamentalsQuery.isError,
                  error: fundamentalsQuery.error,
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
          <>
            {isIntelligenceLoading ? (
              <div className="rounded-lg border border-border bg-surface p-3 text-sm text-muted">
                {t('workspacePage.panels.analysis.intelligence.analyzingAction')}
              </div>
            ) : (
              <>
                <IntelligenceDecisionBrief candidate={candidate} intelligence={displayedIntelligence} />

                {hasNarrative && displayedIntelligence ? (
                  <>
                    <div className="grid gap-3 xl:grid-cols-2">
                      <PositionReviewPanel ticker={ticker} position={position} />
                      <StrategicReviewPanel ticker={ticker} />
                    </div>

                    <details className="rounded-lg border border-border bg-surface p-3">
                      <summary className="cursor-pointer text-sm font-semibold text-foreground">Full intelligence report</summary>
                      <div className="mt-3">
                        <NarrativeAnalysisCard
                          intelligence={displayedIntelligence}
                          candidate={candidate}
                          isPosition={Boolean(position)}
                        />
                      </div>
                    </details>

                    <details className="rounded-lg border border-border bg-surface p-3">
                      <summary className="cursor-pointer text-sm font-semibold text-foreground">Ask about this decision</summary>
                      <div className="mt-3">
                        <IntelligenceChatPanel
                          ticker={ticker}
                          intelligence={displayedIntelligence}
                          candidate={candidate}
                          position={position}
                        />
                      </div>
                    </details>

                    <details className="rounded-lg border border-border bg-surface p-3">
                      <summary className="cursor-pointer text-sm font-semibold text-foreground">Technical details</summary>
                      <div className="mt-3">
                        <AgentTracePanel runId={displayedIntelligence.runId ?? null} />
                      </div>
                    </details>
                  </>
                ) : (
                  <>
                    {renderAnalyzePrompt(
                      'Generate a company and setup review first, then use the optional checks below when you need more context.',
                      Boolean(candidate || position),
                    )}
                    <div className="grid gap-3 xl:grid-cols-2">
                      <PositionReviewPanel ticker={ticker} position={position} />
                      <StrategicReviewPanel ticker={ticker} />
                    </div>
                  </>
                )}

                {hasNarrative && (
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={intelligenceMutation.isPending}
                      onClick={() => handleAnalyzeWithAi(true)}
                    >
                      {intelligenceMutation.isPending
                        ? t('workspacePage.panels.analysis.intelligence.analyzingAction')
                        : 'Refresh decision and intelligence'}
                    </Button>
                    {displayedIntelligence && !intelligenceMutation.isPending && (
                      <span className="text-xs text-muted">
                        Last analyzed: {new Date(displayedIntelligence.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {intelligenceMutation.isError && (
                      <span className="text-xs text-danger">
                        {intelligenceMutation.error instanceof Error
                          ? intelligenceMutation.error.message
                          : t('workspacePage.panels.analysis.intelligence.analyzeError')}
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {activeTab === 'fundamentals' && (
          <>
            <div className="flex items-center justify-between gap-3 py-1">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => refreshFundamentalsMutation.mutate(ticker)}
                disabled={refreshFundamentalsMutation.isPending}
              >
                {refreshFundamentalsMutation.isPending
                  ? fundamentalsQuery.data
                    ? t('workspacePage.panels.analysis.fundamentals.refreshingAction')
                    : t('workspacePage.panels.analysis.fundamentals.runningAction')
                  : fundamentalsQuery.data
                    ? t('workspacePage.panels.analysis.fundamentals.refreshAction')
                    : t('workspacePage.panels.analysis.fundamentals.runAction')}
              </Button>
              {fundamentalsQuery.data && (
                <span className="text-xs text-muted">
                  Updated {formatDateTime(fundamentalsQuery.data.updatedAt)}
                </span>
              )}
            </div>

            {fundamentalsQuery.data ? (
              <details className="rounded-lg border border-border bg-surface p-3">
                <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-muted">
                  About metric labels
                </summary>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {provenanceLegendItems().map((item) => (
                    <div key={item.label} className="rounded-md border border-border bg-surface px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{item.label}</p>
                      <p className="mt-1 text-sm text-muted">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}

            {refreshFundamentalsMutation.isError ? (
              <div className="text-sm text-danger">
                {refreshFundamentalsMutation.error instanceof Error
                  ? refreshFundamentalsMutation.error.message
                  : t('workspacePage.panels.analysis.fundamentals.refreshError')}
              </div>
            ) : null}

            {fundamentalsQuery.isLoading ? (
              <div className="text-sm text-muted">{t('workspacePage.panels.analysis.fundamentals.loading')}</div>
            ) : fundamentalsQuery.isError ? (
              <div className="text-sm text-danger">
                {fundamentalsQuery.error instanceof Error
                  ? fundamentalsQuery.error.message
                  : t('workspacePage.panels.analysis.fundamentals.loadError')}
              </div>
            ) : fundamentalsQuery.data ? (
              <FundamentalsSnapshotCard snapshot={fundamentalsQuery.data} />
            ) : (
              <div className="text-sm text-muted">{t('workspacePage.panels.analysis.fundamentals.noSnapshot')}</div>
            )}
          </>
        )}

      </div>
    </>
  );
}
