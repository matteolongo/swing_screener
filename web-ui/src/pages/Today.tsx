import { useCallback, useEffect, useRef, useState } from 'react';
import CandidateQueue from '@/components/domain/cockpit/CandidateQueue';
import SymbolDetailPanel from '@/components/domain/cockpit/SymbolDetailPanel';
import TodayStatsStrip from '@/components/domain/cockpit/TodayStatsStrip';
import TodayActionList from '@/components/domain/today/TodayActionList';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useOrders } from '@/features/portfolio/hooks';
import { useNavigate } from 'react-router-dom';
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

// ─── Today page (cockpit) ────────────────────────────────────────────────────

export default function Today() {
  const selectedTicker = useWorkspaceStore((state) => state.selectedTicker);
  const workspaceMode = useWorkspaceStore((state) => state.workspaceMode);
  const setWorkspaceSelection = useWorkspaceStore((state) => state.setWorkspaceSelection);
  const clearSelectedTicker = useWorkspaceStore((state) => state.clearSelectedTicker);
  const originControlRef = useRef<HTMLElement | null>(null);
  const originTickerRef = useRef<string | null>(null);
  const previousSelectionRef = useRef(selectedTicker);

  const compact = Boolean(selectedTicker && workspaceMode === 'expanded');

  const handleTickerSelect = useCallback((ticker: string) => {
    const normalized = ticker.trim().toUpperCase();
    if (document.activeElement instanceof HTMLElement) {
      originControlRef.current = document.activeElement;
    }
    originTickerRef.current = normalized || null;
    if (!normalized) return;
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
        replacement?.focus();
        originControlRef.current = replacement ?? null;
      }
    }
    previousSelectionRef.current = selectedTicker;
  }, [selectedTicker]);

  return (
    <div className="mx-auto max-w-[1600px]">
      <TodayStatsStrip />
      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        {/* Left column: attenzioni + candidate queue, always mounted */}
        <div
          className="min-w-0 flex flex-col gap-4 xl:col-span-7"
          onClickCapture={(event) => {
            const control = (event.target as HTMLElement).closest<HTMLElement>('button, [role="button"]');
            if (control) originControlRef.current = control;
          }}
        >
          <div>
            <WeeklyReviewNudge />
            <PendingOrdersBadge />
          </div>
          <div data-testid="today-action-list">
            <TodayActionList compact={compact} onTickerSelect={handleTickerSelect} />
          </div>
          <CandidateQueue onSelectTicker={handleTickerSelect} />
        </div>

        {/* Right column: detail panel or empty state */}
        <div className="min-w-0 flex flex-col xl:col-span-5">
          {selectedTicker ? (
            <SymbolDetailPanel ticker={selectedTicker} onClose={clearSelectedTicker} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center gap-3">
              <div className="text-4xl select-none">📊</div>
              <p className="text-sm font-medium text-muted">
                {t('workspacePage.panels.analysis.empty')}
              </p>
              <p className="text-xs text-muted max-w-xs">
                {t('workspacePage.emptyDescription')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
