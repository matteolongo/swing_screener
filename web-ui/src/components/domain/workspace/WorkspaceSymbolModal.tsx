import { ArrowLeft, ExternalLink, ShoppingCart } from 'lucide-react';
import Button from '@/components/common/Button';
import ModalShell from '@/components/common/ModalShell';
import CachedSymbolPriceChart from '@/components/domain/market/CachedSymbolPriceChart';
import KeyMetrics from '@/components/domain/workspace/KeyMetrics';
import ActionPanel from '@/components/domain/workspace/ActionPanel';
import WorkspaceFundamentalsPanel from '@/components/domain/workspace/WorkspaceFundamentalsPanel';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

interface WorkspaceSymbolModalProps {
  ticker: string;
  onBack: () => void;
}

export default function WorkspaceSymbolModal({ ticker, onBack }: WorkspaceSymbolModalProps) {
  const activeTab = useWorkspaceStore((state) => state.analysisTab);
  const setAnalysisTab = useWorkspaceStore((state) => state.setAnalysisTab);

  const tabs = [
    { id: 'overview', label: t('workspacePage.panels.analysis.tabs.overview') },
    { id: 'fundamentals', label: 'Fundamentals' },
    { id: 'order', label: t('workspacePage.panels.analysis.tabs.order') },
  ] as const;
  const yahooUrl = `https://finance.yahoo.com/quote/${ticker}`;
  const isOrderTab = activeTab === 'order';
  const openOrderTab = () => setAnalysisTab('order');

  return (
    <ModalShell
      title={t('workspacePage.symbolDetails.title', { ticker })}
      onClose={onBack}
      className="max-w-5xl"
      closeOnBackdrop={false}
      headerActions={
        <Button type="button" variant="secondary" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          <span>{t('common.actions.back')}</span>
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('workspacePage.symbolDetails.description')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={isOrderTab ? 'secondary' : 'primary'}
              size="sm"
              className="gap-1.5"
              onClick={openOrderTab}
            >
              <ShoppingCart className="h-4 w-4" />
              <span>{t('workspacePage.symbolDetails.placeBuyAction')}</span>
            </Button>
            <a
              href={yahooUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              title={t('screener.table.yahooTickerTitle', { ticker })}
            >
              <ExternalLink className="h-4 w-4" />
              <span>Yahoo Finance</span>
            </a>
          </div>
        </div>

        <div className="flex w-full items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1" role="tablist" aria-label={t('workspacePage.symbolDetails.tabsAria')}>
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

        <div className="space-y-3">
          {activeTab === 'overview' ? (
            <>
              <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold">{ticker}</h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {t('workspacePage.panels.analysis.chartHint')}
                  </span>
                </div>
                <CachedSymbolPriceChart ticker={ticker} className="mt-2" />
              </div>
              <KeyMetrics ticker={ticker} />
            </>
          ) : null}

          {activeTab === 'fundamentals' ? <WorkspaceFundamentalsPanel ticker={ticker} /> : null}

          {activeTab === 'order' ? <ActionPanel ticker={ticker} /> : null}
        </div>
      </div>
    </ModalShell>
  );
}
