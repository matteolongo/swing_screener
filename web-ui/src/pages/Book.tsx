import { useState, useEffect } from 'react';
import PortfolioRiskSummary from '@/components/domain/portfolio/PortfolioRiskSummary';
import PortfolioPanel from '@/components/domain/workspace/PortfolioPanel';
import { usePositions } from '@/features/portfolio/hooks';
import { useActiveStrategyQuery } from '@/features/strategy/hooks';
import { useWeeklyReviews } from '@/features/weeklyReview/hooks';
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import JournalPage from './Journal';
import AnalyticsPage from './Analytics';
import WeeklyReviewForm, { getCurrentWeekId } from '@/components/domain/weeklyReview/WeeklyReviewForm';
import type { WeeklyReview } from '@/features/weeklyReview/api';
import PendingOrdersTab from '@/components/domain/orders/PendingOrdersTab';

const STORAGE_KEY = 'book.activeTab';
type BookTab = 'positions' | 'orders' | 'journal' | 'performance' | 'review';

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

function PastReviews({ reviews }: { reviews: WeeklyReview[] }) {
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const currentWeekId = getCurrentWeekId();
  const pastReviews = reviews.filter((r) => r.week_id !== currentWeekId);

  if (pastReviews.length === 0) {
    return <p className="text-sm text-gray-400 mt-2">No past weekly reviews yet.</p>;
  }

  return (
    <div className="mt-4 space-y-2">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Past Reviews</h3>
      {pastReviews.map((review) => (
        <div key={review.week_id} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            type="button"
            onClick={() => setExpandedWeek(expandedWeek === review.week_id ? null : review.week_id)}
            className="w-full px-3 py-2 flex items-center justify-between bg-gray-50 dark:bg-gray-900 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-left"
          >
            <span>Week {review.week_id}</span>
            <span className="text-gray-400">{expandedWeek === review.week_id ? '▲' : '▼'}</span>
          </button>
          {expandedWeek === review.week_id && (
            <div className="px-3 py-2 space-y-2 text-sm text-gray-700 dark:text-gray-300">
              {review.what_worked && (
                <div>
                  <span className="font-medium text-xs text-gray-500 uppercase tracking-wide">What Worked</span>
                  <p className="mt-0.5">{review.what_worked}</p>
                </div>
              )}
              {review.what_didnt && (
                <div>
                  <span className="font-medium text-xs text-gray-500 uppercase tracking-wide">What Didn't Work</span>
                  <p className="mt-0.5">{review.what_didnt}</p>
                </div>
              )}
              {review.rules_violated && (
                <div>
                  <span className="font-medium text-xs text-gray-500 uppercase tracking-wide">Rules Violated</span>
                  <p className="mt-0.5">{review.rules_violated}</p>
                </div>
              )}
              {review.next_week_focus && (
                <div>
                  <span className="font-medium text-xs text-gray-500 uppercase tracking-wide">Next Week Focus</span>
                  <p className="mt-0.5">{review.next_week_focus}</p>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function WeeklyReviewTab() {
  const reviewsQuery = useWeeklyReviews();

  return (
    <div className="space-y-4">
      <WeeklyReviewForm weekId={getCurrentWeekId()} />
      {reviewsQuery.data ? (
        <PastReviews reviews={reviewsQuery.data} />
      ) : null}
    </div>
  );
}

export default function Book() {
  const [activeTab, setActiveTab] = useState<BookTab>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'positions' || stored === 'orders' || stored === 'journal' || stored === 'performance' || stored === 'review') {
      return stored;
    }
    return 'positions';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, activeTab);
  }, [activeTab]);

  const tabs: { key: BookTab; label: string }[] = [
    { key: 'positions', label: t('bookPage.tabs.positions') },
    { key: 'orders', label: t('bookPage.tabs.orders') },
    { key: 'journal', label: t('bookPage.tabs.journal') },
    { key: 'performance', label: t('bookPage.tabs.performance') },
    { key: 'review', label: t('bookPage.tabs.review') },
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
        {activeTab === 'orders' && <PendingOrdersTab />}
        {activeTab === 'journal' && <JournalPage />}
        {activeTab === 'performance' && <AnalyticsPage />}
        {activeTab === 'review' && <WeeklyReviewTab />}
      </div>
    </div>
  );
}
