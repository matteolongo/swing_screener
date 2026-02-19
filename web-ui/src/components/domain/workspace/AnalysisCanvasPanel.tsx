import { useEffect, useState } from 'react';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import CachedSymbolPriceChart from '@/components/domain/market/CachedSymbolPriceChart';
import ActionPanel from '@/components/domain/workspace/ActionPanel';
import KeyMetrics from '@/components/domain/workspace/KeyMetrics';
import TradeThesisInput from '@/components/domain/workspace/TradeThesisInput';
import WorkspaceSentimentPanel from '@/components/domain/workspace/WorkspaceSentimentPanel';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { t } from '@/i18n/t';

export default function AnalysisCanvasPanel() {
  const selectedTicker = useWorkspaceStore((state) => state.selectedTicker);
  const [activeTab, setActiveTab] = useState<'overview' | 'sentiment' | 'order'>('overview');

  useEffect(() => {
    setActiveTab('overview');
  }, [selectedTicker]);

  return (
    <Card variant="bordered" className="h-full p-4 md:p-5 flex flex-col gap-4 overflow-hidden">
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
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={activeTab === 'overview' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('overview')}
            >
              {t('workspacePage.panels.analysis.tabs.overview')}
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'sentiment' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('sentiment')}
            >
              {t('workspacePage.panels.analysis.tabs.sentiment')}
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'order' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('order')}
            >
              {t('workspacePage.panels.analysis.tabs.order')}
            </Button>
          </div>

          <div className="flex-1 min-h-0 overflow-auto space-y-3 pr-1">
            {activeTab === 'overview' && (
              <>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
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
                <TradeThesisInput ticker={selectedTicker} />
                <ActionPanel ticker={selectedTicker} />
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
