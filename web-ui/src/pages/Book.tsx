import { useState, useEffect } from 'react';
import PortfolioRiskSummary from '@/components/domain/portfolio/PortfolioRiskSummary';
import PortfolioPanel from '@/components/domain/workspace/PortfolioPanel';
import { usePositions } from '@/features/portfolio/hooks';
import { useActiveStrategyQuery } from '@/features/strategy/hooks';
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import JournalPage from './Journal';
import AnalyticsPage from './Analytics';

const STORAGE_KEY = 'book.activeTab';
type BookTab = 'positions' | 'journal' | 'performance';

function PositionsTab() {
  const openPositionsQuery = usePositions('open');
  const activeStrategyQuery = useActiveStrategyQuery();
  const openPositions = openPositionsQuery.data ?? [];
  const accountSize = activeStrategyQuery.data?.risk?.accountSize;

  return (
    <div className="space-y-4">
      <PortfolioRiskSummary openPositions={openPositions} accountSize={accountSize} />
      <PortfolioPanel />
    </div>
  );
}

export default function Book() {
  const [activeTab, setActiveTab] = useState<BookTab>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'positions' || stored === 'journal' || stored === 'performance') {
      return stored;
    }
    return 'positions';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, activeTab);
  }, [activeTab]);

  const tabs: { key: BookTab; label: string }[] = [
    { key: 'positions', label: t('bookPage.tabs.positions') },
    { key: 'journal', label: t('bookPage.tabs.journal') },
    { key: 'performance', label: t('bookPage.tabs.performance') },
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-4">
      {/* Page header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t('bookPage.title')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('bookPage.subtitle')}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 mb-6">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium transition-colors',
              activeTab === key
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'positions' && <PositionsTab />}
        {activeTab === 'journal' && <JournalPage />}
        {activeTab === 'performance' && <AnalyticsPage />}
      </div>
    </div>
  );
}
