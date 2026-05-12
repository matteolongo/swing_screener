import { useState, useEffect } from 'react';
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import FundamentalsPage from './Fundamentals';
import WatchlistPipelinePanel from '@/components/domain/watchlist/WatchlistPipelinePanel';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const STORAGE_KEY = 'research.activeTab';
type ResearchTab = 'fundamentals' | 'watchlist';

export default function Research() {
  const [activeTab, setActiveTab] = useState<ResearchTab>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'fundamentals' || stored === 'watchlist') {
      return stored;
    }
    return 'fundamentals';
  });
  const setSelectedTicker = useWorkspaceStore((state) => state.setSelectedTicker);

  const [sharedSymbol, setSharedSymbol] = useState('');
  const [committedSymbol, setCommittedSymbol] = useState('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, activeTab);
  }, [activeTab]);

  const tabs: { key: ResearchTab; label: string }[] = [
    { key: 'fundamentals', label: t('researchPage.tabs.fundamentals') },
    { key: 'watchlist', label: t('researchPage.tabs.watchlist') },
  ];

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4">
      {/* Page header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t('researchPage.title')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('researchPage.subtitle')}
        </p>
      </div>

      {/* Symbol search */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={sharedSymbol}
          onChange={(e) => setSharedSymbol(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter') setCommittedSymbol(sharedSymbol); }}
          placeholder={t('researchPage.symbolSearch.placeholder')}
          className="w-48 px-3 py-1.5 text-sm border border-border rounded-md bg-white dark:bg-gray-800"
        />
        <button
          type="button"
          onClick={() => setCommittedSymbol(sharedSymbol)}
          className="px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-md hover:bg-primary/20"
        >
          {t('researchPage.symbolSearch.search')}
        </button>
        {committedSymbol && (
          <button
            type="button"
            onClick={() => { setSharedSymbol(''); setCommittedSymbol(''); }}
            className="px-2 py-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        )}
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
        {activeTab === 'fundamentals' && <FundamentalsPage initialSymbol={committedSymbol} />}
        {activeTab === 'watchlist' && (
          <WatchlistPipelinePanel
            onTickerSelect={(ticker) => {
              setSharedSymbol(ticker);
              setCommittedSymbol(ticker);
              setSelectedTicker(ticker, 'screener');
              setActiveTab('fundamentals');
            }}
          />
        )}
      </div>
    </div>
  );
}
