import { useState, useEffect } from 'react';
import { ArrowLeft, ExternalLink, ShoppingCart } from 'lucide-react';
import Button from '@/components/common/Button';
import ModalShell from '@/components/common/ModalShell';
import CachedSymbolCandleChart from '@/components/domain/market/CachedSymbolCandleChart';
import KeyMetrics from '@/components/domain/workspace/KeyMetrics';
import ActionPanel from '@/components/domain/workspace/ActionPanel';
import IntelligenceCard from '@/components/domain/workspace/IntelligenceCard';
import WorkspaceFundamentalsPanel from '@/components/domain/workspace/WorkspaceFundamentalsPanel';
import { useIntelligenceAnalysisMutation, useIntelligenceLatestQuery } from '@/features/intelligence/hooks';
import type { SymbolIntelligence } from '@/features/intelligence/types';
import type { PositionWithMetrics } from '@/features/portfolio/api';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

interface WorkspaceSymbolModalProps {
  ticker: string;
  position?: PositionWithMetrics | null;
  onBack: () => void;
}

export default function WorkspaceSymbolModal({ ticker, position = null, onBack }: WorkspaceSymbolModalProps) {
  const activeTab = useWorkspaceStore((state) => state.analysisTab);
  const setAnalysisTab = useWorkspaceStore((state) => state.setAnalysisTab);
  const intelligenceMutation = useIntelligenceAnalysisMutation();
  const intelligenceLatest = useIntelligenceLatestQuery(ticker, activeTab === 'overview');
  const [intelligenceResult, setIntelligenceResult] = useState<SymbolIntelligence | null>(null);
  const displayedIntelligence = intelligenceResult ?? intelligenceLatest.data ?? null;
  const hasNarrative = Boolean(!intelligenceLatest.isLoading && displayedIntelligence?.narrative?.trim());

  useEffect(() => {
    setIntelligenceResult(null);
    intelligenceMutation.reset();
  }, [ticker]);

  const handleAnalyzeWithAi = () => {
    intelligenceMutation.mutate(
      { ticker, candidate: null, position },
      { onSuccess: (result) => setIntelligenceResult(result) },
    );
  };

  const tabs = [
    { id: 'overview', label: t('workspacePage.panels.analysis.tabs.overview') },
    { id: 'fundamentals', label: t('workspacePage.panels.analysis.tabs.fundamentals') },
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

        <div className="flex w-full items-center gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1" role="tablist" aria-label={t('workspacePage.symbolDetails.tabsAria')}>
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
                  isActive ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground'
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
                <CachedSymbolCandleChart ticker={ticker} className="mt-2" width={760} height={240} />
              </div>
              <KeyMetrics ticker={ticker} />
              <div className="rounded-lg border border-border bg-surface p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {t('workspacePage.panels.analysis.intelligence.overviewPromptTitle')}
                    </p>
                    {position && (
                      <p className="mt-0.5 text-xs text-muted">
                        {t('workspacePage.panels.analysis.intelligence.overviewPromptDescription')}
                      </p>
                    )}
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
                      : hasNarrative
                        ? t('workspacePage.panels.analysis.intelligence.refreshAction')
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
              {displayedIntelligence ? <IntelligenceCard intelligence={displayedIntelligence} /> : null}
            </>
          ) : null}

          {activeTab === 'fundamentals' ? <WorkspaceFundamentalsPanel ticker={ticker} /> : null}

          {activeTab === 'order' ? <ActionPanel ticker={ticker} /> : null}
        </div>
      </div>
    </ModalShell>
  );
}
