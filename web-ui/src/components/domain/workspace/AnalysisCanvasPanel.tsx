import { useEffect } from 'react';

import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import CachedSymbolPriceChart from '@/components/domain/market/CachedSymbolPriceChart';
import FundamentalsSnapshotCard from '@/components/domain/fundamentals/FundamentalsSnapshotCard';
import IntelligenceOpportunityCard from '@/components/domain/intelligence/IntelligenceOpportunityCard';
import ActionPanel from '@/components/domain/workspace/ActionPanel';
import DecisionSummaryCard from '@/components/domain/workspace/DecisionSummaryCard';
import {
  useFundamentalSnapshotQuery,
  useRefreshFundamentalSnapshotMutation,
} from '@/features/fundamentals/hooks';
import {
  useIntelligenceOpportunitiesScoped,
  useIntelligenceUpcomingCatalystsQuery,
} from '@/features/intelligence/hooks';
import type { IntelligenceUpcomingCatalyst } from '@/features/intelligence/types';
import { syncCandidateWithFundamentals } from '@/features/screener/decisionSummary';
import type { SymbolIntelligenceStatus } from '@/features/intelligence/useSymbolIntelligenceRunner';
import { useScreenerStore } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import { formatDateTime, formatPercent } from '@/utils/formatters';

interface AnalysisCanvasPanelProps {
  onRunSymbolIntelligence?: (ticker: string) => void;
  symbolIntelligenceStatus?: SymbolIntelligenceStatus;
}

export default function AnalysisCanvasPanel({
  onRunSymbolIntelligence,
  symbolIntelligenceStatus,
}: AnalysisCanvasPanelProps) {
  const selectedTicker = useWorkspaceStore((state) => state.selectedTicker);
  const lastScreenerResult = useScreenerStore((state) => state.lastResult);
  const patchCandidate = useScreenerStore((state) => state.patchCandidate);
  const activeTab = useWorkspaceStore((state) => state.analysisTab);
  const setAnalysisTab = useWorkspaceStore((state) => state.setAnalysisTab);
  const selectedCandidate = lastScreenerResult?.candidates.find(
    (candidate) => candidate.ticker.toUpperCase() === selectedTicker?.toUpperCase()
  );

  const fundamentalsQuery = useFundamentalSnapshotQuery(
    activeTab === 'fundamentals' ? selectedTicker ?? undefined : undefined
  );
  const refreshFundamentalsMutation = useRefreshFundamentalSnapshotMutation();
  const latestFundamentalsSnapshot = refreshFundamentalsMutation.data ?? fundamentalsQuery.data;

  const intelligenceQuery = useIntelligenceOpportunitiesScoped(
    undefined,
    selectedTicker ? [selectedTicker] : [],
    activeTab === 'intelligence' && !!selectedTicker
  );
  const catalystsQuery = useIntelligenceUpcomingCatalystsQuery(
    undefined,
    selectedTicker ? [selectedTicker] : [],
    14,
    activeTab === 'intelligence' && !!selectedTicker
  );

  const tabs: Array<{
    id: 'overview' | 'fundamentals' | 'intelligence' | 'order';
    label: string;
  }> = [
    { id: 'overview', label: t('workspacePage.panels.analysis.tabs.overview') },
    { id: 'fundamentals', label: t('workspacePage.panels.analysis.tabs.fundamentals') },
    { id: 'intelligence', label: 'Intelligence' },
    { id: 'order', label: t('workspacePage.panels.analysis.tabs.order') },
  ];

  useEffect(() => {
    if (!selectedTicker || !selectedCandidate || !latestFundamentalsSnapshot) {
      return;
    }

    if (latestFundamentalsSnapshot.symbol.trim().toUpperCase() !== selectedTicker.trim().toUpperCase()) {
      return;
    }

    if (syncCandidateWithFundamentals(selectedCandidate, latestFundamentalsSnapshot) === selectedCandidate) {
      return;
    }

    patchCandidate(selectedTicker, (candidate) => syncCandidateWithFundamentals(candidate, latestFundamentalsSnapshot));
  }, [latestFundamentalsSnapshot, patchCandidate, selectedCandidate, selectedTicker]);

  const opportunity = intelligenceQuery.data?.opportunities?.[0] ?? null;
  const catalysts = catalystsQuery.data?.items ?? [];

  return (
    <Card
      id="workspace-analysis-canvas"
      variant="bordered"
      className="p-3 md:p-4 flex min-h-0 flex-col gap-3 xl:h-full"
    >
      {!selectedTicker ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center gap-3">
          <div className="text-4xl select-none">📊</div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('workspacePage.panels.analysis.empty')}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
            Run the screener and select a symbol to see its analysis, trade plan, and intelligence.
          </p>
        </div>
      ) : (
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
                  onClick={() => setAnalysisTab(tab.id)}
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
            {activeTab === 'overview' && (
              <>
                {selectedCandidate?.decisionSummary ? (
                  <DecisionSummaryCard
                    summary={selectedCandidate.decisionSummary}
                    currency={selectedCandidate.currency}
                  />
                ) : null}
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white p-3">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{selectedTicker}</span>
                    {onRunSymbolIntelligence ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onRunSymbolIntelligence(selectedTicker)}
                        disabled={symbolIntelligenceStatus?.stage === 'queued' || symbolIntelligenceStatus?.stage === 'running'}
                      >
                        {symbolIntelligenceStatus?.stage === 'queued' || symbolIntelligenceStatus?.stage === 'running'
                          ? t('screener.symbolIntelligence.running')
                          : t('screener.symbolIntelligence.runAction')}
                      </Button>
                    ) : null}
                  </div>
                  {symbolIntelligenceStatus?.stage === 'completed' ? (
                    <p className="text-xs text-gray-500 mb-2">
                      {t('screener.symbolIntelligence.updatedAt', {
                        at: formatDateTime(
                          symbolIntelligenceStatus.explanationGeneratedAt || symbolIntelligenceStatus.updatedAt
                        ),
                      })}
                    </p>
                  ) : symbolIntelligenceStatus?.stage === 'error' ? (
                    <p className="text-xs text-rose-600 mb-2">{symbolIntelligenceStatus.error || t('screener.error.unknown')}</p>
                  ) : null}
                  <CachedSymbolPriceChart ticker={selectedTicker} />
                </div>
                {selectedCandidate ? (
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'ATR', value: selectedCandidate.atr.toFixed(2) },
                      { label: 'SMA 20', value: selectedCandidate.sma20.toFixed(2) },
                      { label: 'SMA 50', value: selectedCandidate.sma50.toFixed(2) },
                      { label: 'SMA 200', value: selectedCandidate.sma200.toFixed(2) },
                      { label: 'Mom 6M', value: formatPercent(selectedCandidate.momentum6m * 100) },
                      { label: 'Mom 12M', value: formatPercent(selectedCandidate.momentum12m * 100) },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-md border border-gray-200 bg-white px-2 py-1.5">
                        <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
                        <p className="mt-0.5 text-xs font-mono font-semibold text-gray-800 dark:text-gray-200">{value}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            )}

            {activeTab === 'order' && <ActionPanel ticker={selectedTicker} />}

            {activeTab === 'fundamentals' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
                  <div>
                    <h3 className="text-base font-semibold">{selectedTicker}</h3>
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
                    onClick={() => refreshFundamentalsMutation.mutate(selectedTicker)}
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

                {/* Quick metrics summary */}
                {fundamentalsQuery.data ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      {
                        label: 'P/E',
                        value: fundamentalsQuery.data.trailingPe ?? null,
                        suffix: undefined as string | undefined,
                        good: (v: number) => v < 25,
                      },
                      {
                        label: 'P/S',
                        value: fundamentalsQuery.data.priceToSales ?? null,
                        suffix: undefined as string | undefined,
                        good: (v: number) => v < 5,
                      },
                      {
                        label: 'Rev Growth',
                        value: fundamentalsQuery.data.revenueGrowthYoy != null
                          ? fundamentalsQuery.data.revenueGrowthYoy * 100
                          : null,
                        suffix: '%' as string | undefined,
                        good: (v: number) => v > 10,
                      },
                      {
                        label: 'Gross Margin',
                        value: fundamentalsQuery.data.grossMargin != null
                          ? fundamentalsQuery.data.grossMargin * 100
                          : null,
                        suffix: '%' as string | undefined,
                        good: (v: number) => v > 40,
                      },
                    ].map(({ label, value, suffix, good }) => (
                      <div
                        key={label}
                        className="rounded-md border border-gray-200 bg-white p-2"
                      >
                        <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
                        {value != null ? (
                          <p className={`mt-1 text-sm font-mono font-semibold ${good(value) ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {value.toFixed(1)}{suffix ?? ''}
                          </p>
                        ) : (
                          <p className="mt-1 text-sm text-gray-400">—</p>
                        )}
                      </div>
                    ))}
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

            {activeTab === 'intelligence' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
                  <h3 className="text-base font-semibold">{selectedTicker} — Intelligence</h3>
                  {onRunSymbolIntelligence ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onRunSymbolIntelligence(selectedTicker)}
                      disabled={symbolIntelligenceStatus?.stage === 'queued' || symbolIntelligenceStatus?.stage === 'running'}
                    >
                      {symbolIntelligenceStatus?.stage === 'queued' || symbolIntelligenceStatus?.stage === 'running'
                        ? t('screener.symbolIntelligence.running')
                        : t('screener.symbolIntelligence.runAction')}
                    </Button>
                  ) : null}
                </div>

                {intelligenceQuery.isLoading ? (
                  <div className="text-sm text-gray-500">Loading intelligence…</div>
                ) : opportunity ? (
                  <IntelligenceOpportunityCard opportunity={opportunity} />
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-6 text-center">
                    <p className="text-sm text-gray-500">
                      Run Intelligence to get insights for {selectedTicker}
                    </p>
                  </div>
                )}

                {catalysts.length > 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Upcoming Catalysts (14d)</h4>
                    <ul className="space-y-1.5">
                      {catalysts.map((catalyst: IntelligenceUpcomingCatalyst, idx: number) => (
                        <li key={idx} className="text-xs text-gray-700 dark:text-gray-300 flex items-start gap-2">
                          <span className="mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-400" />
                          <span>
                            {catalyst.eventType || catalyst.eventSubtype || 'Event'}
                            {catalyst.eventAt ? ` · ${catalyst.eventAt}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}

          </div>
        </>
      )}
    </Card>
  );
}
