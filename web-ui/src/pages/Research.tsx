import { useState, useEffect } from 'react';
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import IntelligencePage from './Intelligence';
import FundamentalsPage from './Fundamentals';
import EventsCalendar from '@/components/domain/calendar/EventsCalendar';
import { usePositions } from '@/features/portfolio/hooks';
import { useWatchlist } from '@/features/watchlist/hooks';

const STORAGE_KEY = 'research.activeTab';
type ResearchTab = 'intelligence' | 'fundamentals' | 'calendar';

export default function Research() {
  const [activeTab, setActiveTab] = useState<ResearchTab>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'intelligence' || stored === 'fundamentals' || stored === 'calendar') {
      return stored;
    }
    return 'intelligence';
  });

  const openPositionsQuery = usePositions('open');
  const watchlistQuery = useWatchlist();

  const calendarSymbols = [
    ...new Set([
      ...(openPositionsQuery.data ?? []).map((p) => p.ticker),
      ...(watchlistQuery.data ?? []).map((w) => w.ticker),
    ]),
  ];

  const [sharedSymbol, setSharedSymbol] = useState('');
  const [committedSymbol, setCommittedSymbol] = useState('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, activeTab);
  }, [activeTab]);

  const tabs: { key: ResearchTab; label: string }[] = [
    { key: 'intelligence', label: t('researchPage.tabs.intelligence') },
    { key: 'fundamentals', label: t('researchPage.tabs.fundamentals') },
    { key: 'calendar', label: t('researchPage.tabs.calendar') },
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
        {activeTab === 'intelligence' && <IntelligencePage initialSymbol={committedSymbol} />}
        {activeTab === 'fundamentals' && <FundamentalsPage initialSymbol={committedSymbol} />}
        {activeTab === 'calendar' && (
          <EventsCalendar symbols={calendarSymbols} daysAhead={30} />
        )}
      </div>
    </div>
  );
}
