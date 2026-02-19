import Card from '@/components/common/Card';
import CachedSymbolPriceChart from '@/components/domain/market/CachedSymbolPriceChart';
import KeyMetrics from '@/components/domain/workspace/KeyMetrics';
import TradeThesisInput from '@/components/domain/workspace/TradeThesisInput';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { t } from '@/i18n/t';

export default function AnalysisCanvasPanel() {
  const selectedTicker = useWorkspaceStore((state) => state.selectedTicker);

  return (
    <Card variant="bordered" className="h-full flex flex-col gap-4">
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
        <div className="space-y-3">
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
          <TradeThesisInput ticker={selectedTicker} />
        </div>
      )}
    </Card>
  );
}
