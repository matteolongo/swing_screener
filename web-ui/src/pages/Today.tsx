import { useCallback, useEffect, useRef, useState } from 'react';
import { ClipboardCheck, Crosshair, RefreshCw, X } from 'lucide-react';
import CandidateQueue from '@/components/domain/cockpit/CandidateQueue';
import SymbolDetailPanel from '@/components/domain/cockpit/SymbolDetailPanel';
import TodayStatsStrip from '@/components/domain/cockpit/TodayStatsStrip';
import TodayActionList from '@/components/domain/today/TodayActionList';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useScreenerStore } from '@/stores/screenerStore';
import ResultQualitySummary from '@/components/domain/screener/ResultQualitySummary';
import { useOrders } from '@/features/portfolio/hooks';
import { useNavigate } from 'react-router-dom';
import { t } from '@/i18n/t';
import { useWeeklyReviews } from '@/features/weeklyReview/hooks';
import { getCurrentWeekId } from '@/components/domain/weeklyReview/WeeklyReviewForm';
import { useTodayRefresh } from '@/features/screener/useTodayRefresh';
import Button from '@/components/common/Button';
import PositionProtectionNotice from '@/components/domain/orders/PositionProtectionNotice';
import WorkspaceIntro from '@/components/layout/WorkspaceIntro';
import { formatDateTime } from '@/utils/formatters';
import { cn } from '@/utils/cn';

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
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2">
      <span className="min-w-0 text-sm text-primary flex-1 basis-48">
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
        className="grid h-11 w-11 shrink-0 place-items-center rounded text-primary hover:bg-primary/10"
        aria-label={t('todayPage.weeklyNudge.dismiss')}
      >
        <X className="h-4 w-4" aria-hidden="true" />
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
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2">
      <span className="text-sm text-warning">
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

// ─── Today page (cockpit) ────────────────────────────────────────────────────

export default function Today() {
  const todayRefresh = useTodayRefresh();
  const todayRun = useScreenerStore(state => state.todayRun);
  const lastResult = useScreenerStore(state => state.lastResult);
  const lastRunContext = useScreenerStore(state => state.lastRunContext);
  const selectedTicker = useWorkspaceStore((state) => state.selectedTicker);
  const setWorkspaceSelection = useWorkspaceStore((state) => state.setWorkspaceSelection);
  const clearSelectedTicker = useWorkspaceStore((state) => state.clearSelectedTicker);
  const [focusRequest, setFocusRequest] = useState<number | null>(null);
  const originControlRef = useRef<HTMLElement | null>(null);
  const originTickerRef = useRef<string | null>(null);
  const previousSelectionRef = useRef(selectedTicker);

  const handleTickerSelect = useCallback((ticker: string, focusInspector = true) => {
    const normalized = ticker.trim().toUpperCase();
    if (!focusInspector && document.activeElement instanceof HTMLElement) {
      originControlRef.current = document.activeElement;
    }
    originTickerRef.current = normalized || null;
    if (!normalized) return;
    setFocusRequest((previous) => focusInspector ? (previous ?? 0) + 1 : null);
    // CandidateQueue and TodayActionList already write the full
    // WorkspaceSelection envelope (ticker, source, runId, candidate, rowId)
    // via setWorkspaceSelection before invoking this callback. Only ensure a
    // selection exists here so the detail panel always has something to show.
    const current = useWorkspaceStore.getState().selection;
    if (current?.ticker !== normalized) {
      setWorkspaceSelection({
        ticker: normalized,
        source: 'last_run',
        rowId: `queue:${normalized}`,
      });
    }
  }, [setWorkspaceSelection]);

  useEffect(() => {
    if (previousSelectionRef.current && !selectedTicker) {
      if (originControlRef.current?.isConnected) {
        originControlRef.current.focus();
      } else if (originTickerRef.current) {
        const queue = document.querySelector('[data-testid="candidate-queue"]');
        const replacement = [...(queue?.querySelectorAll<HTMLElement>('button') ?? [])].find(
          (control) => control.textContent?.includes(originTickerRef.current ?? ''),
        );
        (replacement ?? document.getElementById('candidate-review'))?.focus();
        originControlRef.current = replacement ?? null;
      }
    }
    previousSelectionRef.current = selectedTicker;
  }, [selectedTicker]);

  const scanSource = todayRun
    ? t('cockpit.review.pinned', { source: todayRun.request.preset ?? t('cockpit.review.customScan') })
    : t('cockpit.review.lastRun');

  return (
    <div className="mx-auto min-w-0 max-w-[1440px] space-y-6 pb-8">
      <WorkspaceIntro label={t('cockpit.review.eyebrow')} title={t('cockpit.review.title')} description={t('cockpit.review.description')} action={
        <Button onClick={todayRefresh.refresh} disabled={todayRefresh.isRefreshing} className="gap-2">
          <RefreshCw className={cn('h-4 w-4', todayRefresh.isRefreshing && 'motion-safe:animate-spin')} aria-hidden="true" />
          {todayRefresh.isRefreshing ? t('todayPage.refresh.running') : todayRefresh.error ? t('screener.quality.retry') : t('todayPage.refresh.action')}
        </Button>
      } />
      <PositionProtectionNotice />
      <div className="space-y-3">
        {todayRefresh.error ? (
          <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {t('todayPage.refresh.error', { message: todayRefresh.error.message })}
          </p>
        ) : null}
        <ResultQualitySummary result={todayRun?.result ?? lastResult} completedAt={todayRun ? todayRun.completedAt : lastRunContext?.completedAt}
          isRefreshing={todayRefresh.isRefreshing} error={todayRefresh.error} source={scanSource} />
        <p role="status" className="px-1 text-xs text-muted">
          {todayRefresh.isRefreshing ? t('todayPage.refresh.runningHint') : todayRefresh.updatedAt
            ? t('todayPage.refresh.updated', { time: formatDateTime(todayRefresh.updatedAt) })
            : t('todayPage.refresh.description')}
        </p>
      </div>
      <TodayStatsStrip />
      <WeeklyReviewNudge />

      <div className={cn('grid min-w-0 items-start gap-5', selectedTicker && 'xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]')}>
        <div className={cn('grid min-w-0 items-start gap-5', !selectedTicker && 'xl:grid-cols-[minmax(0,4fr)_minmax(0,5fr)]')}
          onClickCapture={(event) => {
            const control = (event.target as HTMLElement).closest<HTMLElement>('button');
            if (control) originControlRef.current = control;
          }}
        >
          <section aria-labelledby="portfolio-attention" className="min-w-0 rounded-xl border border-border bg-surface">
            <div className="flex items-start gap-3 border-b border-border px-4 py-4">
              <ClipboardCheck className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <h2 id="portfolio-attention" className="text-base font-semibold">{t('cockpit.review.attentionTitle')}</h2>
                <p className="mt-1 text-sm text-muted">{t('cockpit.review.attentionDescription')}</p>
              </div>
            </div>
            <PendingOrdersBadge />
            <div data-testid="today-action-list">
              <TodayActionList onTickerSelect={handleTickerSelect} />
            </div>
          </section>
          <section id="candidate-review" aria-labelledby="candidate-review-title" tabIndex={-1}
            className="min-w-0 scroll-mt-6 rounded-xl border border-border bg-surface">
            <div className="flex items-start gap-3 border-b border-border px-4 py-4">
              <Crosshair className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <h2 id="candidate-review-title" className="text-base font-semibold">{t('cockpit.review.candidatesTitle')}</h2>
                <p className="mt-1 text-sm text-muted">{t('cockpit.review.candidatesDescription')}</p>
              </div>
            </div>
            <div className="p-3">
              <CandidateQueue onSelectTicker={handleTickerSelect} isRefreshing={todayRefresh.isRefreshing} />
            </div>
          </section>
        </div>
        {selectedTicker ? (
          <SymbolDetailPanel ticker={selectedTicker} onClose={clearSelectedTicker} focusRequest={focusRequest}
            isRefreshingToday={todayRefresh.isRefreshing} onRefreshToday={todayRefresh.refresh} todayRefreshError={todayRefresh.error} />
        ) : null}
      </div>
    </div>
  );
}
