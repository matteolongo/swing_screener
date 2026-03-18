import Card from '@/components/common/Card';
import CachedSymbolPriceChart from '@/components/domain/market/CachedSymbolPriceChart';
import FundamentalsSnapshotCard from '@/components/domain/fundamentals/FundamentalsSnapshotCard';
import ActionPanel from '@/components/domain/workspace/ActionPanel';
import KeyMetrics from '@/components/domain/workspace/KeyMetrics';
import { useFundamentalSnapshotQuery } from '@/features/fundamentals/hooks';
import type { SymbolIntelligenceStatus } from '@/features/intelligence/useSymbolIntelligenceRunner';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import Button from '@/components/common/Button';
import { formatDateTime } from '@/utils/formatters';

interface AnalysisCanvasPanelProps {
  onRunSymbolIntelligence?: (ticker: string) => void;
  symbolIntelligenceStatus?: SymbolIntelligenceStatus;
}

export default function AnalysisCanvasPanel({
  onRunSymbolIntelligence,
  symbolIntelligenceStatus,
}: AnalysisCanvasPanelProps) {
  const selectedTicker = useWorkspaceStore((state) => state.selectedTicker);
  const activeTab = useWorkspaceStore((state) => state.analysisTab);
  const setAnalysisTab = useWorkspaceStore((state) => state.setAnalysisTab);
  const fundamentalsQuery = useFundamentalSnapshotQuery(
    activeTab === 'fundamentals' ? selectedTicker ?? undefined : undefined
  );
  const tabs: Array<{
    id: 'overview' | 'fundamentals' | 'order';
    label: string;
  }> = [
    { id: 'overview', label: t('workspacePage.panels.analysis.tabs.overview') },
    { id: 'fundamentals', label: 'Fundamentals' },
    { id: 'order', label: t('workspacePage.panels.analysis.tabs.order') },
  ];

  return (
    <Card
      id="workspace-analysis-canvas"
      variant="bordered"
      className="p-4 md:p-5 flex min-h-0 flex-col gap-4 xl:h-full"
    >
      <div>
        <h2 className="text-lg font-semibold">{t('workspacePage.panels.analysis.title')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {t('workspacePage.panels.analysis.description')}
        </p>
      </div>

      {!selectedTicker ? (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('workspacePage.panels.analysis.empty')}
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
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-base font-semibold">{selectedTicker}</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {t('workspacePage.panels.analysis.chartHint')}
                      </span>
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
                  </div>
                  {symbolIntelligenceStatus ? (
                    <div className="mt-2">
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {symbolIntelligenceStatus.stage === 'completed'
                          ? t('screener.symbolIntelligence.completed', {
                              source:
                                symbolIntelligenceStatus.explanationSource === 'llm'
                                  ? t('screener.symbolIntelligence.sourceLlm')
                                  : t('screener.symbolIntelligence.sourceFallback'),
                            })
                          : symbolIntelligenceStatus.stage === 'error'
                            ? t('screener.symbolIntelligence.error', {
                                error: symbolIntelligenceStatus.error || t('screener.error.unknown'),
                              })
                            : symbolIntelligenceStatus.stage === 'queued'
                              ? t('screener.symbolIntelligence.queued')
                              : symbolIntelligenceStatus.stage === 'running'
                                ? t('screener.symbolIntelligence.running')
                                : t('screener.symbolIntelligence.idle')}
                      </p>
                      {symbolIntelligenceStatus.stage === 'completed' &&
                      (symbolIntelligenceStatus.explanationGeneratedAt || symbolIntelligenceStatus.updatedAt) ? (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {t('screener.symbolIntelligence.updatedAt', {
                            at: formatDateTime(
                              symbolIntelligenceStatus.explanationGeneratedAt || symbolIntelligenceStatus.updatedAt
                            ),
                          })}
                        </p>
                      ) : null}
                      {symbolIntelligenceStatus.stage === 'completed' && symbolIntelligenceStatus.warning ? (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                          {t('screener.symbolIntelligence.warning', {
                            warning: symbolIntelligenceStatus.warning,
                          })}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <CachedSymbolPriceChart ticker={selectedTicker} className="mt-2" />
                </div>
                <KeyMetrics ticker={selectedTicker} />
              </>
            )}

            {activeTab === 'order' && <ActionPanel ticker={selectedTicker} />}

            {activeTab === 'fundamentals' && (
              <>
                {fundamentalsQuery.isLoading ? (
                  <div className="text-sm text-gray-500">Loading fundamentals...</div>
                ) : fundamentalsQuery.isError ? (
                  <div className="text-sm text-rose-600">
                    {fundamentalsQuery.error instanceof Error
                      ? fundamentalsQuery.error.message
                      : 'Failed to load fundamentals'}
                  </div>
                ) : fundamentalsQuery.data ? (
                  <FundamentalsSnapshotCard snapshot={fundamentalsQuery.data} />
                ) : (
                  <div className="text-sm text-gray-500">No fundamentals snapshot available.</div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
