import type { ReactNode } from 'react';
import Button from '@/components/common/Button';
import CachedSymbolPriceChart from '@/components/domain/market/CachedSymbolPriceChart';
import FundamentalsSnapshotCard from '@/components/domain/fundamentals/FundamentalsSnapshotCard';
import IntelligenceOpportunityCard from '@/components/domain/intelligence/IntelligenceOpportunityCard';
import AnalysisDecisionStrip from '@/components/domain/workspace/AnalysisDecisionStrip';
import SymbolTradeHistory from '@/components/domain/workspace/SymbolTradeHistory';
import DecisionSummaryCard from '@/components/domain/workspace/DecisionSummaryCard';
import TechnicalMetricsGrid from '@/components/domain/workspace/TechnicalMetricsGrid';
import type { SymbolAnalysisCandidate, WorkspaceAnalysisTab } from '@/components/domain/workspace/types';
import {
  useFundamentalSnapshotQuery,
  useRefreshFundamentalSnapshotMutation,
} from '@/features/fundamentals/hooks';
import {
  useIntelligenceOpportunitiesScoped,
  useIntelligenceUpcomingCatalystsQuery,
} from '@/features/intelligence/hooks';
import type { IntelligenceUpcomingCatalyst } from '@/features/intelligence/types';
import type { SymbolIntelligenceStatus } from '@/features/intelligence/useSymbolIntelligenceRunner';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/formatters';

interface SymbolAnalysisContentProps {
  ticker: string;
  candidate?: SymbolAnalysisCandidate | null;
  activeTab: WorkspaceAnalysisTab;
  onTabChange: (tab: WorkspaceAnalysisTab) => void;
  orderPanel?: ReactNode;
  onRunSymbolIntelligence?: (ticker: string) => void;
  symbolIntelligenceStatus?: SymbolIntelligenceStatus;
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
  activeTab,
  onTabChange,
  orderPanel = null,
  onRunSymbolIntelligence,
  symbolIntelligenceStatus,
}: SymbolAnalysisContentProps) {
  const intelligenceAsofDate = symbolIntelligenceStatus?.asofDate;
  const fundamentalsQuery = useFundamentalSnapshotQuery(
    activeTab === 'fundamentals' ? ticker : undefined
  );
  const refreshFundamentalsMutation = useRefreshFundamentalSnapshotMutation();
  const intelligenceQuery = useIntelligenceOpportunitiesScoped(
    intelligenceAsofDate,
    ticker ? [ticker] : [],
    activeTab === 'intelligence' && !!ticker
  );
  const catalystsQuery = useIntelligenceUpcomingCatalystsQuery(
    intelligenceAsofDate,
    ticker ? [ticker] : [],
    14,
    activeTab === 'intelligence' && !!ticker
  );

  const opportunity = intelligenceQuery.data?.opportunities?.[0] ?? null;
  const catalysts = catalystsQuery.data?.items ?? [];
  const intelligenceDiagnostics = symbolIntelligenceStatus
    ? [
        {
          label: 'Events kept',
          value: symbolIntelligenceStatus.eventsKeptCount,
        },
        {
          label: 'Events dropped',
          value: symbolIntelligenceStatus.eventsDroppedCount,
        },
        {
          label: 'Duplicates',
          value: symbolIntelligenceStatus.duplicateSuppressedCount,
        },
        {
          label: 'LLM warnings',
          value: symbolIntelligenceStatus.llmWarningsCount,
        },
      ].filter((item) => item.value != null)
    : [];
  const tabs: Array<{ id: WorkspaceAnalysisTab; label: string }> = [
    { id: 'overview', label: t('workspacePage.panels.analysis.tabs.overview') },
    { id: 'fundamentals', label: t('workspacePage.panels.analysis.tabs.fundamentals') },
    { id: 'intelligence', label: 'Intelligence' },
    { id: 'order', label: t('workspacePage.panels.analysis.tabs.order') },
  ];

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
        {candidate?.priorTrades && (
          <button
            key="history"
            type="button"
            role="tab"
            aria-selected={activeTab === 'history'}
            onClick={() => onTabChange('history')}
            className={cn(
              'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            )}
          >
            {t('symbolAnalysis.historyTab')}
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
        <AnalysisDecisionStrip ticker={ticker} candidate={candidate} />

        {activeTab === 'overview' && (
          <>
            {candidate?.decisionSummary ? (
              <DecisionSummaryCard summary={candidate.decisionSummary} currency={candidate.currency} />
            ) : null}
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

        {activeTab === 'intelligence' && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
              <div>
                <h3 className="text-base font-semibold">{ticker} — Intelligence</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Catalyst and timing diagnostics for this symbol only.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {symbolIntelligenceStatus?.stage === 'completed' ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    Last checked {formatDateTime(symbolIntelligenceStatus.updatedAt)}
                  </span>
                ) : null}
                {onRunSymbolIntelligence ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onRunSymbolIntelligence(ticker)}
                    disabled={symbolIntelligenceStatus?.stage === 'queued' || symbolIntelligenceStatus?.stage === 'running'}
                  >
                    {symbolIntelligenceStatus?.stage === 'queued' || symbolIntelligenceStatus?.stage === 'running'
                      ? t('screener.symbolIntelligence.running')
                      : t('screener.symbolIntelligence.runAction')}
                  </Button>
                ) : null}
              </div>
            </div>

            {symbolIntelligenceStatus?.stage === 'queued' ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                {t('screener.intelligence.statusQueued', {
                  total: symbolIntelligenceStatus.totalSymbols ?? 1,
                })}
                <p className="mt-1 text-xs text-blue-700">
                  {t('screener.intelligence.updatedAt', {
                    updatedAt: formatDateTime(symbolIntelligenceStatus.updatedAt),
                  })}
                </p>
              </div>
            ) : null}

            {symbolIntelligenceStatus?.stage === 'running' ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                {t('screener.intelligence.statusRunning', {
                  completed: symbolIntelligenceStatus.completedSymbols ?? 0,
                  total: symbolIntelligenceStatus.totalSymbols ?? 1,
                })}
                <p className="mt-1 text-xs text-blue-700">
                  {t('screener.intelligence.updatedAt', {
                    updatedAt: formatDateTime(symbolIntelligenceStatus.updatedAt),
                  })}
                </p>
              </div>
            ) : null}

            {symbolIntelligenceStatus?.stage === 'completed' ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                {t('screener.intelligence.statusCompleted', {
                  completed: symbolIntelligenceStatus.completedSymbols ?? symbolIntelligenceStatus.totalSymbols ?? 1,
                  total: symbolIntelligenceStatus.totalSymbols ?? 1,
                  opportunities: symbolIntelligenceStatus.opportunitiesCount ?? 0,
                })}
                <p className="mt-1 text-xs text-emerald-700">
                  {t('screener.intelligence.updatedAt', {
                    updatedAt: formatDateTime(symbolIntelligenceStatus.updatedAt),
                  })}
                </p>
                {symbolIntelligenceStatus.analysisSummary ? (
                  <p className="mt-2 text-sm text-emerald-950">{symbolIntelligenceStatus.analysisSummary}</p>
                ) : null}
              </div>
            ) : null}

            {symbolIntelligenceStatus?.stage === 'error' ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
                {symbolIntelligenceStatus.error || t('screener.error.unknown')}
              </div>
            ) : null}

            {intelligenceQuery.isLoading ? (
              <div className="text-sm text-gray-500">Loading intelligence…</div>
            ) : opportunity ? (
              <IntelligenceOpportunityCard opportunity={opportunity} />
            ) : symbolIntelligenceStatus?.stage === 'completed' ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-left dark:border-gray-700">
                <p className="text-sm font-semibold text-slate-800">No actionable intelligence setup right now</p>
                <p className="mt-2 text-sm text-slate-600">
                  No opportunity passed the current intelligence thresholds for {ticker}.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Why not</p>
                    <p className="mt-2 text-sm text-slate-700">
                      {symbolIntelligenceStatus.analysisSummary
                        ?? 'The latest signal did not clear the required catalyst and timing filters.'}
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">What to watch</p>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-700">
                      <li>A cleaner price move into the preferred entry zone.</li>
                      <li>Fresh catalyst confirmation or renewed relative strength.</li>
                    </ul>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Run diagnostics</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-700">
                      {intelligenceDiagnostics.length ? (
                        intelligenceDiagnostics.map((item) => (
                          <div key={item.label} className="rounded-md bg-slate-50 px-2 py-1.5">
                            <div className="text-[10px] uppercase tracking-wide text-slate-500">{item.label}</div>
                            <div className="mt-1 font-semibold text-slate-900">{item.value}</div>
                          </div>
                        ))
                      ) : (
                        <p className="col-span-2 text-sm text-slate-600">
                          Last checked {formatDateTime(symbolIntelligenceStatus.updatedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                {symbolIntelligenceStatus.llmWarningSample ? (
                  <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <span className="font-semibold">Model warning:</span> {symbolIntelligenceStatus.llmWarningSample}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-6 text-center">
                <p className="text-sm text-gray-500">Run Intelligence to get insights for {ticker}</p>
              </div>
            )}

            {catalysts.length > 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Upcoming Catalysts (14d)</h4>
                <ul className="space-y-1.5">
                  {catalysts.map((catalyst: IntelligenceUpcomingCatalyst, index: number) => (
                    <li key={index} className="text-xs text-gray-700 dark:text-gray-300 flex items-start gap-2">
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

        {activeTab === 'history' && ticker && (
          <div className="overflow-y-auto flex-1 pt-2">
            <SymbolTradeHistory ticker={ticker} />
          </div>
        )}
      </div>
    </>
  );
}
