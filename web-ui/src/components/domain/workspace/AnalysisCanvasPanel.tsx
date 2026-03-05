import Card from '@/components/common/Card';
import CachedSymbolPriceChart from '@/components/domain/market/CachedSymbolPriceChart';
import ActionPanel from '@/components/domain/workspace/ActionPanel';
import KeyMetrics from '@/components/domain/workspace/KeyMetrics';
import TradeThesisPanel from '@/components/domain/workspace/TradeThesisPanel';
import WorkspaceSentimentPanel from '@/components/domain/workspace/WorkspaceSentimentPanel';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';

export default function AnalysisCanvasPanel() {
  const selectedTicker = useWorkspaceStore((state) => state.selectedTicker);
  const activeTab = useWorkspaceStore((state) => state.analysisTab);
  const setAnalysisTab = useWorkspaceStore((state) => state.setAnalysisTab);
  const tabs: Array<{
    id: 'overview' | 'sentiment' | 'order';
    label: string;
  }> = [
    { id: 'overview', label: t('workspacePage.panels.analysis.tabs.overview') },
    { id: 'sentiment', label: t('workspacePage.panels.analysis.tabs.sentiment') },
    { id: 'order', label: t('workspacePage.panels.analysis.tabs.order') },
  ];

  return (
    <Card
      id="workspace-analysis-canvas"
      variant="bordered"
      className="p-4 md:p-5 flex flex-col gap-3 xl:h-full xl:overflow-hidden"
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
        <div className="flex flex-col gap-3 xl:flex-1 xl:min-h-0 xl:overflow-hidden">
          <div
            className="flex w-full items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1"
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

          <div className="space-y-3 xl:flex-1 xl:min-h-0 xl:overflow-auto xl:pr-1">
            {activeTab === 'overview' && (
              <>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold">{selectedTicker}</h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {t('workspacePage.panels.analysis.chartHint')}
                    </span>
                  </div>
                  <CachedSymbolPriceChart ticker={selectedTicker} className="mt-2" />
                </div>
                <KeyMetrics ticker={selectedTicker} />
              </>
            )}

            {activeTab === 'sentiment' && <WorkspaceSentimentPanel ticker={selectedTicker} />}

            {activeTab === 'order' && (
              <>
                <TradeThesisPanel ticker={selectedTicker} />
                <ActionPanel ticker={selectedTicker} />
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
