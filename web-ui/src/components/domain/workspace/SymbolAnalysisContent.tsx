import type { ReactNode } from 'react';
import Button from '@/components/common/Button';
import CachedSymbolPriceChart from '@/components/domain/market/CachedSymbolPriceChart';
import FundamentalsSnapshotCard from '@/components/domain/fundamentals/FundamentalsSnapshotCard';
import IntelligenceOpportunityCard from '@/components/domain/intelligence/IntelligenceOpportunityCard';
import DecisionSummaryCard from '@/components/domain/workspace/DecisionSummaryCard';
import TechnicalMetricsGrid from '@/components/domain/workspace/TechnicalMetricsGrid';
import type { SymbolAnalysisCandidate, WorkspaceAnalysisTab } from '@/components/domain/workspace/types';
import {
  useFundamentalSnapshotQuery,
  useRefreshFundamentalSnapshotMutation,
} from '@/features/fundamentals/hooks';
import {
  formatFundamentalMetricMeta,
  metricHorizonClass,
  metricHorizonLabel,
} from '@/features/fundamentals/presentation';
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
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
        {activeTab === 'overview' && (
          <>
            {candidate?.decisionSummary ? (
              <DecisionSummaryCard summary={candidate.decisionSummary} currency={candidate.currency} />
            ) : null}
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white p-3">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{ticker}</span>
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
              <CachedSymbolPriceChart ticker={ticker} />
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
              <div className="space-y-2">
                <p className="text-xs text-gray-500">
                  Metric labels show whether a number is price-derived, latest-quarter, latest-FY, or a source snapshot.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  {
                    key: 'trailing_pe',
                    label: 'P/E',
                    value: fundamentalsQuery.data.trailingPe ?? null,
                    suffix: undefined as string | undefined,
                    good: (value: number) => value < 25,
                  },
                  {
                    key: 'price_to_sales',
                    label: 'P/S',
                    value: fundamentalsQuery.data.priceToSales ?? null,
                    suffix: undefined as string | undefined,
                    good: (value: number) => value < 5,
                  },
                  {
                    key: 'revenue_growth_yoy',
                    label: 'Revenue YoY',
                    value: fundamentalsQuery.data.revenueGrowthYoy != null
                      ? fundamentalsQuery.data.revenueGrowthYoy * 100
                      : null,
                    suffix: '%' as string | undefined,
                    good: (value: number) => value > 10,
                  },
                  {
                    key: 'gross_margin',
                    label: 'Gross Margin',
                    value: fundamentalsQuery.data.grossMargin != null
                      ? fundamentalsQuery.data.grossMargin * 100
                      : null,
                    suffix: '%' as string | undefined,
                    good: (value: number) => value > 40,
                  },
                ].map(({ key, label, value, suffix, good }) => {
                  const context = fundamentalsQuery.data.metricContext[key];
                  const meta = formatFundamentalMetricMeta(key, context);
                  return (
                  <div key={key} className="rounded-md border border-gray-200 bg-white p-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${metricHorizonClass(key, context)}`}
                      >
                        {metricHorizonLabel(key, context)}
                      </span>
                    </div>
                    {value != null ? (
                      <p className={`mt-1 text-sm font-mono font-semibold ${good(value) ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {value.toFixed(1)}{suffix ?? ''}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-gray-400">—</p>
                    )}
                    {meta ? <p className="mt-1 text-[11px] text-gray-500">{meta}</p> : null}
                  </div>
                )})}
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
              <h3 className="text-base font-semibold">{ticker} — Intelligence</h3>
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
      </div>
    </>
  );
}
