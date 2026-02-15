import { useState } from 'react';
import ModalShell from '@/components/common/ModalShell';
import type { Recommendation } from '@/types/recommendation';
import { t } from '@/i18n/t';
import RecommendationSection from './sections/RecommendationSection';
import ThesisSection from './sections/ThesisSection';
import LearnSection from './sections/LearnSection';
import { cn } from '@/utils/cn';

interface TradeInsightModalProps {
  ticker: string;
  recommendation?: Recommendation;
  currency?: 'USD' | 'EUR';
  defaultTab?: 'recommendation' | 'thesis' | 'learn';
  onClose: () => void;
}

type TabId = 'recommendation' | 'thesis' | 'learn';

interface Tab {
  id: TabId;
  labelKey: string;
  enabled: boolean;
}

export default function TradeInsightModal({
  ticker,
  recommendation,
  currency = 'USD',
  defaultTab = 'recommendation',
  onClose,
}: TradeInsightModalProps) {
  const hasThesis = !!recommendation?.thesis;
  
  // Determine initial tab
  const getInitialTab = (): TabId => {
    if (defaultTab === 'thesis' && hasThesis) return 'thesis';
    if (defaultTab === 'recommendation' && recommendation) return 'recommendation';
    return 'learn';
  };

  const [activeTab, setActiveTab] = useState<TabId>(getInitialTab);

  const tabs: Tab[] = [
    {
      id: 'recommendation',
      labelKey: 'tradeInsight.tabs.recommendation',
      enabled: !!recommendation,
    },
    {
      id: 'thesis',
      labelKey: 'tradeInsight.tabs.thesis',
      enabled: hasThesis,
    },
    {
      id: 'learn',
      labelKey: 'tradeInsight.tabs.learn',
      enabled: true,
    },
  ];

  const enabledTabs = tabs.filter((tab) => tab.enabled);

  return (
    <ModalShell
      title={t('tradeInsight.title', { ticker })}
      onClose={onClose}
      className="max-w-4xl"
      closeAriaLabel={t('modal.closeAria')}
    >
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 -mt-6 mb-6">
        <nav className="flex gap-1" aria-label={t('tradeInsight.tabsAria')}>
          {enabledTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300',
              )}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div role="tabpanel">
        {activeTab === 'recommendation' && (
          <RecommendationSection
            recommendation={recommendation}
            currency={currency}
          />
        )}
        {activeTab === 'thesis' && hasThesis && (
          <ThesisSection thesis={recommendation.thesis} />
        )}
        {activeTab === 'learn' && <LearnSection />}
      </div>
    </ModalShell>
  );
}
