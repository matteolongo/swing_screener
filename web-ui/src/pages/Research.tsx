import { useState, useEffect } from 'react';
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import IntelligencePage from './Intelligence';
import FundamentalsPage from './Fundamentals';

const STORAGE_KEY = 'research.activeTab';
type ResearchTab = 'intelligence' | 'fundamentals';

export default function Research() {
  const [activeTab, setActiveTab] = useState<ResearchTab>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'intelligence' || stored === 'fundamentals') {
      return stored;
    }
    return 'intelligence';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, activeTab);
  }, [activeTab]);

  const tabs: { key: ResearchTab; label: string }[] = [
    { key: 'intelligence', label: t('researchPage.tabs.intelligence') },
    { key: 'fundamentals', label: t('researchPage.tabs.fundamentals') },
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
        {activeTab === 'intelligence' && <IntelligencePage />}
        {activeTab === 'fundamentals' && <FundamentalsPage />}
      </div>
    </div>
  );
}
