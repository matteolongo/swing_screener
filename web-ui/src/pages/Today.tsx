import { useCallback, useState } from 'react';
import ScreenerInboxPanel from '@/components/domain/workspace/ScreenerInboxPanel';
import TodayActionList from '@/components/domain/today/TodayActionList';
import WatchlistPipelinePanel from '@/components/domain/watchlist/WatchlistPipelinePanel';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useOrders } from '@/features/portfolio/hooks';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import { useWeeklyReviews } from '@/features/weeklyReview/hooks';
import { getCurrentWeekId } from '@/components/domain/weeklyReview/WeeklyReviewForm';

// ─── Weekly review nudge ─────────────────────────────────────────────────────

function WeeklyReviewNudge() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const { data: reviews } = useWeeklyReviews();
  const currentWeekId = getCurrentWeekId();
  const isFriday = new Date().getDay() === 5;
  const hasCurrentWeekReview = (reviews ?? []).some((r) => r.week_id === currentWeekId);
  if (!isFriday || hasCurrentWeekReview || dismissed) return null;
  return (
    <div className="mb-3 flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2">
      <span className="text-sm text-primary flex-1">
        {t('todayPage.weeklyNudge.message')}
      </span>
      <button
        type="button"
        onClick={() => navigate('/book', { state: { tab: 'review' } })}
        className="text-xs font-medium text-primary hover:underline shrink-0"
      >
        {t('todayPage.weeklyNudge.action')}
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-xs text-primary hover:text-primary shrink-0"
        aria-label={t('todayPage.weeklyNudge.dismiss')}
      >
        ✕
      </button>
    </div>
  );
}

// ─── Pending orders badge ────────────────────────────────────────────────────

function PendingOrdersBadge() {
  const ordersQuery = useOrders('pending');
  const navigate = useNavigate();
  const count = (ordersQuery.data ?? []).filter((o) => o.orderKind === 'entry').length;
  if (count === 0) return null;

  const label =
    count === 1
      ? t('todayPage.pendingBadge.singular', { count: String(count) })
      : t('todayPage.pendingBadge.plural', { count: String(count) });

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2">
      <span className="text-sm text-warning">
        <span aria-hidden="true">⏳ </span>
        <span>{label}</span>
      </span>
      <button
        type="button"
        onClick={() => navigate('/book', { state: { tab: 'orders' } })}
        className="ml-auto text-xs font-medium text-warning hover:underline"
      >
        {t('todayPage.pendingBadge.goToOrders')}
      </button>
    </div>
  );
}

// ─── Today page ──────────────────────────────────────────────────────────────

type LeftTab = 'today' | 'screener' | 'watchlist';

const LEFT_TAB_LABEL_KEYS: Record<LeftTab, 'todayPage.tabs.today' | 'todayPage.tabs.screener' | 'todayPage.tabs.watchlist'> = {
  today: 'todayPage.tabs.today',
  screener: 'todayPage.tabs.screener',
  watchlist: 'todayPage.tabs.watchlist',
};

export default function Today() {
  const setSelectedTicker = useWorkspaceStore((state) => state.setSelectedTicker);

  const [leftTab, setLeftTab] = useState<LeftTab>('today');

  const handleTickerSelect = useCallback((ticker: string) => {
    setSelectedTicker(ticker, 'screener');
  }, [setSelectedTicker]);

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="flex flex-col xl:h-[calc(100vh-120px)] min-h-[500px]">
        {/* Tab bar */}
        <div className="flex border-b border-border shrink-0">
          {(['today', 'screener', 'watchlist'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setLeftTab(tab)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium transition-colors capitalize',
                leftTab === tab
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted hover:text-foreground'
              )}
            >
              {t(LEFT_TAB_LABEL_KEYS[tab])}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {leftTab === 'today' && (
            <>
              <div className="px-3 pt-3">
                <WeeklyReviewNudge />
                <PendingOrdersBadge />
              </div>
              <TodayActionList onTickerSelect={handleTickerSelect} />
            </>
          )}
          {leftTab === 'screener' && (
            <ScreenerInboxPanel />
          )}
          {leftTab === 'watchlist' && (
            <div className="h-full overflow-auto px-3 pt-3">
              <WatchlistPipelinePanel onTickerSelect={handleTickerSelect} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
