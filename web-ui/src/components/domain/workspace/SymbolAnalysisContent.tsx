import { useState, useEffect, type ReactNode } from 'react';
import Button from '@/components/common/Button';
import IntelligenceCard from '@/components/domain/workspace/IntelligenceCard';
import CatalystContextCard from '@/components/domain/workspace/CatalystContextCard';
import { useIntelligenceAnalysisMutation, useIntelligenceLatestQuery } from '@/features/intelligence/hooks';
import { useSymbolCatalystQuery } from '@/features/intelligence/catalysts/hooks';
import type { SymbolIntelligence } from '@/features/intelligence/types';
import CachedSymbolPriceChart from '@/components/domain/market/CachedSymbolPriceChart';
import FundamentalsSnapshotCard from '@/components/domain/fundamentals/FundamentalsSnapshotCard';
import AnalysisDecisionStrip from '@/components/domain/workspace/AnalysisDecisionStrip';
import DecisionSummaryCard from '@/components/domain/workspace/DecisionSummaryCard';
import NarrativeAnalysisCard from '@/components/domain/workspace/NarrativeAnalysisCard';
import TechnicalMetricsGrid from '@/components/domain/workspace/TechnicalMetricsGrid';
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
}: SymbolAnalysisContentProps) {
  const watchlistQuery = useWatchlist();
  const watchSymbolMutation = useWatchSymbolMutation();
  const unwatchSymbolMutation = useUnwatchSymbolMutation();
  const fundamentalsQuery = useFundamentalSnapshotQuery(
    activeTab === 'fundamentals' ? ticker : undefined
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
  const intelligenceLatest = useIntelligenceLatestQuery(ticker, activeTab === 'overview');
  const catalystQuery = useSymbolCatalystQuery(ticker, activeTab === 'overview');
  const [intelligenceResult, setIntelligenceResult] = useState<SymbolIntelligence | null>(null);
  const displayedIntelligence = intelligenceResult ?? intelligenceLatest.data ?? null;
  const hasNarrative = Boolean(!intelligenceLatest.isLoading && displayedIntelligence?.narrative?.trim());

  const handleAnalyzeWithAi = () => {
    intelligenceMutation.mutate(
      { ticker, candidate, position },
      { onSuccess: (result) => setIntelligenceResult(result) }
    );
  };

  useEffect(() => {
    setIntelligenceResult(null);
    intelligenceMutation.reset();
  }, [ticker]);

  const tabs: Array<{ id: WorkspaceAnalysisTab; label: string }> = [
    { id: 'overview', label: t('workspacePage.panels.analysis.tabs.overview') },
    { id: 'fundamentals', label: t('workspacePage.panels.analysis.tabs.fundamentals') },
    { id: 'order', label: t('workspacePage.panels.analysis.tabs.order') },
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

  return (
    <>
      <div
        className="flex-shrink-0 flex w-full items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1"
        role="tablist"
        aria-label={t('workspacePage.panels.analysis.title')}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                isActive ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
        <AnalysisDecisionStrip
          ticker={ticker}
          candidate={candidate}
          onPrepareOrder={() => onTabChange('order')}
          isWatched={isWatched}
          isPendingWatch={isWatchPending}
          onWatch={handleWatch}
          onUnwatch={handleUnwatch}
        />

        {activeTab === 'overview' && (
          <>
            {!candidate && (
              <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 flex flex-col gap-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('workspacePage.panels.analysis.computeAnalysis.description', { ticker })}
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => computeAnalysisMutation.mutate({ tickers: [ticker], top: 1 })}
                    disabled={computeAnalysisMutation.isPending}
                  >
                    {computeAnalysisMutation.isPending
                      ? t('workspacePage.panels.analysis.computeAnalysis.runningAction')
                      : t('workspacePage.panels.analysis.computeAnalysis.runAction')}
                  </Button>
                </div>
                {computeAnalysisMutation.isError && (
                  <p className="text-sm text-rose-600">
                    {computeAnalysisMutation.error instanceof Error
                      ? computeAnalysisMutation.error.message
                      : t('workspacePage.panels.analysis.computeAnalysis.runError')}
                  </p>
                )}
              </div>
            )}
            {(() => {
              if (hasNarrative && displayedIntelligence) {
                return (
                  <NarrativeAnalysisCard
                    intelligence={displayedIntelligence}
                    candidate={candidate}
                    currency={candidate?.currency}
                  />
                );
              }
              if (candidate?.decisionSummary) {
                return (
                  <DecisionSummaryCard
                    summary={candidate.decisionSummary}
                    currency={candidate.currency}
                  />
                );
              }
              return null;
            })()}
            {!hasNarrative && candidate && (
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {t('workspacePage.panels.analysis.intelligence.overviewPromptTitle')}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {t('workspacePage.panels.analysis.intelligence.overviewPromptDescription')}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={intelligenceMutation.isPending}
                    onClick={handleAnalyzeWithAi}
                  >
                    {intelligenceMutation.isPending
                      ? t('workspacePage.panels.analysis.intelligence.analyzingAction')
                      : t('workspacePage.panels.analysis.intelligence.analyzeAction')}
                  </Button>
                </div>
                {intelligenceMutation.isError && (
                  <p className="mt-2 text-sm text-rose-600">
                    {intelligenceMutation.error instanceof Error
                      ? intelligenceMutation.error.message
                      : t('workspacePage.panels.analysis.intelligence.analyzeError')}
                  </p>
                )}
              </div>
            )}
            {hasNarrative && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={intelligenceMutation.isPending}
                  onClick={handleAnalyzeWithAi}
                >
                  {intelligenceMutation.isPending
                    ? t('workspacePage.panels.analysis.intelligence.analyzingAction')
                    : t('workspacePage.panels.analysis.intelligence.refreshAction')}
                </Button>
                {displayedIntelligence && !intelligenceMutation.isPending && (
                  <span className="text-xs text-gray-400">
                    {t('workspacePage.panels.analysis.intelligence.lastAnalyzed')}:{' '}
                    {new Date(displayedIntelligence.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            )}
            {catalystQuery.data && (
              <CatalystContextCard opportunity={catalystQuery.data} />
            )}
            {displayedIntelligence ? <IntelligenceCard intelligence={displayedIntelligence} /> : null}
            <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700">
              <CachedSymbolPriceChart
                ticker={ticker}
                defaultOpen
                showToggle={false}
                width={820}
                height={200}
              />
            </div>
            {candidate ? <TechnicalMetricsGrid candidate={candidate} /> : null}
          </>
        )}

        {activeTab === 'order' ? orderPanel : null}

        {activeTab === 'fundamentals' && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
              <div>
                <h3 className="text-base font-semibold">{ticker}</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {fundamentalsQuery.data
                    ? t('workspacePage.panels.analysis.fundamentals.descriptionHasSnapshot')
                    : t('workspacePage.panels.analysis.fundamentals.descriptionNoSnapshot')}
                </p>
              </div>
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
            </div>

            {fundamentalsQuery.data ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Metric labels</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Read horizon pills as source context, not as another scorecard.
                    </p>
                  </div>
                  <div className="text-xs text-slate-500">
                    Updated {formatDateTime(fundamentalsQuery.data.updatedAt)}
                  </div>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {provenanceLegendItems().map((item) => (
                    <div key={item.label} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                      <p className="mt-1 text-sm text-slate-700">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {refreshFundamentalsMutation.isError ? (
              <div className="text-sm text-rose-600">
                {refreshFundamentalsMutation.error instanceof Error
                  ? refreshFundamentalsMutation.error.message
                  : t('workspacePage.panels.analysis.fundamentals.refreshError')}
              </div>
            ) : null}

            {fundamentalsQuery.isLoading ? (
              <div className="text-sm text-gray-500">{t('workspacePage.panels.analysis.fundamentals.loading')}</div>
            ) : fundamentalsQuery.isError ? (
              <div className="text-sm text-rose-600">
                {fundamentalsQuery.error instanceof Error
                  ? fundamentalsQuery.error.message
                  : t('workspacePage.panels.analysis.fundamentals.loadError')}
              </div>
            ) : fundamentalsQuery.data ? (
              <FundamentalsSnapshotCard snapshot={fundamentalsQuery.data} />
            ) : (
              <div className="text-sm text-gray-500">{t('workspacePage.panels.analysis.fundamentals.noSnapshot')}</div>
            )}
          </>
        )}

      </div>
    </>
  );
}
