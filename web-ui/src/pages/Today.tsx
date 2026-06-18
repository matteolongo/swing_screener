import { useCallback, useEffect, useRef, useState } from 'react';
import AnalysisCanvasPanel from '@/components/domain/workspace/AnalysisCanvasPanel';
import ScreenerInboxPanel from '@/components/domain/workspace/ScreenerInboxPanel';
import TodayActionList from '@/components/domain/today/TodayActionList';
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

type LeftTab = 'today' | 'screener';
type TabletTab = 'left' | 'analysis';

export default function Today() {
  const setSelectedTicker = useWorkspaceStore((state) => state.setSelectedTicker);
  const selectedTicker = useWorkspaceStore((state) => state.selectedTicker);

  const [leftTab, setLeftTab] = useState<LeftTab>('today');
  const [activeTablet, setActiveTablet] = useState<TabletTab>('left');
  const prevTickerRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedTicker && selectedTicker !== prevTickerRef.current) {
      prevTickerRef.current = selectedTicker;
      setActiveTablet('analysis');
    }
  }, [selectedTicker]);

  const handleTickerSelect = useCallback((ticker: string) => {
    setSelectedTicker(ticker, 'screener');
  }, [setSelectedTicker]);

  return (
    <div className="mx-auto max-w-[1600px]">
      {/* Tablet tab switcher — only visible below xl breakpoint */}
      <div className="xl:hidden flex border-b border-border mb-3">
        {(['left', 'analysis'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTablet(tab)}
            className={cn(
              'flex-1 py-2 text-sm font-medium capitalize transition-colors',
              activeTablet === tab
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted hover:text-foreground'
            )}
          >
            {tab === 'left' ? t('todayPage.tabs.today') : t('workspacePage.panels.analysis.title')}
          </button>
        ))}
      </div>

      <div className="flex gap-4 xl:h-[calc(100vh-120px)] min-h-[500px]">
        {/* Left panel */}
        <div
          className={cn(
            'min-w-0 flex flex-col xl:overflow-hidden xl:w-7/12',
            activeTablet === 'left' ? 'w-full' : 'hidden xl:flex'
          )}
        >
          {/* Left panel tab bar */}
          <div className="flex border-b border-border shrink-0">
            {(['today', 'screener'] as const).map((tab) => (
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
                {tab === 'today' ? t('todayPage.tabs.today') : t('todayPage.tabs.screener')}
              </button>
            ))}
          </div>

          {/* Left panel content */}
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
          </div>
        </div>

        {/* Right panel */}
        <div
          className={cn(
            'min-w-0 flex flex-col xl:overflow-hidden xl:w-5/12',
            activeTablet === 'analysis' ? 'w-full' : 'hidden xl:flex'
          )}
        >
          <AnalysisCanvasPanel />
        </div>
      </div>
    </div>
  );
}
