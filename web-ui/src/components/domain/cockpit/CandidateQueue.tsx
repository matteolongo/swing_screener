import { useMemo, useState } from 'react';
import RChip from '@/components/common/RChip';
import { formatWorkflowNextStep, getWorkflowPresentation } from '@/components/domain/recommendation/workflowPresentation';
import type { WorkflowTone } from '@/components/domain/recommendation/workflowPresentation';
import { ScreenerRunningPanel } from '@/components/domain/workspace/ScreenerInboxPanel';
import { prioritizeCandidates } from '@/features/screener/prioritization';
import { getCanonicalOrderDraft, type ScreenerCandidate } from '@/features/screener/types';
import { t } from '@/i18n/t';
import type { MessageKey } from '@/i18n/types';
import { useScreenerStore } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { normalizeWorkflowStatus, type WorkflowStatus } from '@/types/recommendation';

interface QueueGroup {
  status: WorkflowStatus;
  labelKey: MessageKey;
}

const QUEUE_GROUPS: QueueGroup[] = [
  { status: 'ready', labelKey: 'cockpit.queue.ready' },
  { status: 'waiting_trigger', labelKey: 'cockpit.queue.waiting' },
  { status: 'needs_review', labelKey: 'cockpit.queue.needsReview' },
  { status: 'no_setup', labelKey: 'cockpit.queue.noSetup' },
];

const TONE_TEXT_CLASS: Record<WorkflowTone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  neutral: 'text-muted',
};

interface CandidateQueueProps {
  onSelectTicker: (ticker: string) => void;
}

export default function CandidateQueue({ onSelectTicker }: CandidateQueueProps) {
  const todayResult = useScreenerStore((s) => s.todayRun?.result);
  const lastResult = useScreenerStore((s) => s.lastResult);
  const todayCompletedAt = useScreenerStore((s) => s.todayRun?.completedAt);
  const lastRunCompletedAt = useScreenerStore((s) => s.lastRunContext?.completedAt);
  const todayRunInitialized = useScreenerStore((s) => s.todayRunInitialized);
  const setWorkspaceSelection = useWorkspaceStore((s) => s.setWorkspaceSelection);
  const [query, setQuery] = useState('');
  const [showNoSetup, setShowNoSetup] = useState(false);

  const result = todayResult ?? lastResult;
  const fromToday = todayResult != null;

  const candidates = useMemo(
    () => prioritizeCandidates(result?.candidates ?? []),
    [result],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toUpperCase();
    if (!needle) return candidates;
    return candidates.filter((candidate) => candidate.ticker.toUpperCase().includes(needle));
  }, [candidates, query]);

  const groups = useMemo(
    () => QUEUE_GROUPS
      .filter((group) => group.status !== 'no_setup' || showNoSetup)
      .map((group) => ({
        ...group,
        presentation: getWorkflowPresentation({ workflowStatus: group.status }),
        candidates: filtered.filter(
          (candidate) => normalizeWorkflowStatus(candidate.recommendation?.workflowStatus) === group.status,
        ),
      }))
      .filter((group) => group.candidates.length > 0),
    [filtered, showNoSetup],
  );

  const handleSelect = (candidate: ScreenerCandidate) => {
    const normalized = candidate.ticker.trim().toUpperCase();
    const source = fromToday ? 'today_run' : 'last_run';
    const runId = fromToday ? todayCompletedAt : lastRunCompletedAt;
    setWorkspaceSelection({
      ticker: normalized,
      source,
      runId,
      candidate,
      rowId: `${source}:${runId ?? result?.asofDate ?? 'run'}:${normalized}`,
    });
    onSelectTicker(normalized);
  };

  if (!todayRunInitialized && !result) {
    return (
      <div data-testid="candidate-queue" className="flex flex-col gap-3">
        <ScreenerRunningPanel />
      </div>
    );
  }

  return (
    <div data-testid="candidate-queue" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('cockpit.queue.searchPlaceholder')}
          aria-label={t('cockpit.queue.searchPlaceholder')}
          className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted"
        />
        <button
          type="button"
          onClick={() => setShowNoSetup((visible) => !visible)}
          className="shrink-0 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-muted hover:text-foreground"
        >
          {showNoSetup ? t('cockpit.queue.hideNoSetup') : t('cockpit.queue.showNoSetup')}
        </button>
      </div>
      {groups.map((group) => (
        <section key={group.status} aria-label={t(group.labelKey)} className="flex flex-col gap-1.5">
          <h3 className={`text-xs font-semibold uppercase tracking-wide ${TONE_TEXT_CLASS[group.presentation.tone]}`}>
            {`${t(group.labelKey)} (${group.candidates.length})`}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {group.candidates.map((candidate) => {
              const ticker = candidate.ticker.trim().toUpperCase();
              const canReviewOrder = Boolean(getCanonicalOrderDraft(candidate));
              return (
                <li
                  key={candidate.ticker}
                  className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2"
                >
                  <button
                    type="button"
                    onClick={() => handleSelect(candidate)}
                    aria-label={`${t('cockpit.queue.details')} ${ticker}`}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="shrink-0 text-sm font-semibold text-foreground">{ticker}</span>
                    {candidate.name ? (
                      <span className="min-w-0 truncate text-xs text-muted">{candidate.name}</span>
                    ) : null}
                    <span className="min-w-0 flex-1 truncate text-xs text-muted">
                      {formatWorkflowNextStep(candidate.recommendation?.nextStep)}
                    </span>
                    {candidate.rr != null && candidate.rr > 0 ? (
                      <RChip value={candidate.rr} />
                    ) : null}
                  </button>
                  {canReviewOrder ? (
                    <button
                      type="button"
                      onClick={() => handleSelect(candidate)}
                      aria-label={`${t('cockpit.queue.reviewOrder')} ${ticker}`}
                      className="shrink-0 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                    >
                      {t('cockpit.queue.reviewOrder')}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
