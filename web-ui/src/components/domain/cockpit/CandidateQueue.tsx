import { useId, useMemo, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import Button from '@/components/common/Button';
import { formatWorkflowNextStep, getWorkflowPresentation } from '@/components/domain/recommendation/workflowPresentation';
import type { WorkflowTone } from '@/components/domain/recommendation/workflowPresentation';
import { ScreenerRunningPanel } from '@/components/domain/workspace/ScreenerInboxPanel';
import { filterCandidates, prioritizeCandidates } from '@/features/screener/prioritization';
import { getCanonicalOrderDraft, type ScreenerCandidate } from '@/features/screener/types';
import { t } from '@/i18n/t';
import type { MessageKey } from '@/i18n/types';
import { useScreenerStore } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { normalizeWorkflowStatus, type WorkflowStatus } from '@/types/recommendation';
import { cn } from '@/utils/cn';
import { formatNumber } from '@/utils/formatters';

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
  isRefreshing?: boolean;
}

export default function CandidateQueue({ onSelectTicker, isRefreshing = false }: CandidateQueueProps) {
  const todayResult = useScreenerStore((s) => s.todayRun?.result);
  const lastResult = useScreenerStore((s) => s.lastResult);
  const todayCompletedAt = useScreenerStore((s) => s.todayRun?.completedAt);
  const lastRunCompletedAt = useScreenerStore((s) => s.lastRunContext?.completedAt);
  const todayRunInitialized = useScreenerStore((s) => s.todayRunInitialized);
  const displayFilters = useScreenerStore((s) => s.todayRun?.displayFilters);
  const setDisplayFilters = useScreenerStore((s) => s.setTodayRunDisplayFilters);
  const selectedRowId = useWorkspaceStore((s) => s.selection?.rowId);
  const setWorkspaceSelection = useWorkspaceStore((s) => s.setWorkspaceSelection);
  const setAnalysisTab = useWorkspaceStore((s) => s.setAnalysisTab);
  const [query, setQuery] = useState('');
  const [showNoSetup, setShowNoSetup] = useState(false);
  const descriptionId = useId();
  const hasSavedActionFilter = displayFilters != null && displayFilters.actionFilter !== 'all';
  const showNoSetupRows = showNoSetup && !displayFilters?.recommendedOnly && !hasSavedActionFilter;

  const result = todayResult ?? lastResult;
  const fromToday = todayResult != null;
  const source = fromToday ? 'today_run' : 'last_run';
  const runId = fromToday ? todayCompletedAt : lastRunCompletedAt;

  const candidates = useMemo(
    () => prioritizeCandidates(result?.candidates ?? []),
    [result],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toUpperCase();
    const visible = displayFilters ? filterCandidates(candidates, displayFilters) : candidates;
    if (!needle) return visible;
    return visible.filter((candidate) =>
      candidate.ticker.toUpperCase().includes(needle) || candidate.name?.toUpperCase().includes(needle),
    );
  }, [candidates, displayFilters, query]);

  const groups = useMemo(
    () => QUEUE_GROUPS
      .filter((group) => group.status !== 'no_setup' || showNoSetupRows)
      .map((group) => ({
        ...group,
        presentation: getWorkflowPresentation({ workflowStatus: group.status }),
        candidates: filtered.filter(
          (candidate) => normalizeWorkflowStatus(candidate.recommendation?.workflowStatus) === group.status,
        ),
      }))
      .filter((group) => group.candidates.length > 0),
    [filtered, showNoSetupRows],
  );

  const rowIdFor = (ticker: string) => `${source}:${runId ?? result?.asofDate ?? 'run'}:${ticker}`;
  const handleSelect = (candidate: ScreenerCandidate, reviewOrder = false) => {
    const normalized = candidate.ticker.trim().toUpperCase();
    setWorkspaceSelection({
      ticker: normalized,
      source,
      runId,
      candidate,
      rowId: rowIdFor(normalized),
    });
    setAnalysisTab(reviewOrder ? 'order' : 'overview');
    onSelectTicker(normalized);
  };

  if ((!todayRunInitialized || isRefreshing) && !result) {
    return (
      <div data-testid="candidate-queue" className="flex flex-col gap-3">
        <ScreenerRunningPanel />
      </div>
    );
  }

  return (
    <div data-testid="candidate-queue" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-40">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('cockpit.queue.searchPlaceholder')}
            aria-label={t('cockpit.queue.searchPlaceholder')}
            className="min-h-11 w-full min-w-0 rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-pressed={showNoSetupRows}
          onClick={() => {
            if (displayFilters?.recommendedOnly || hasSavedActionFilter) {
              setDisplayFilters({ recommendedOnly: false, actionFilter: 'all' });
            }
            setShowNoSetup(!showNoSetupRows);
          }}
        >
          {t(showNoSetupRows ? 'cockpit.queue.hideNoSetup' : 'cockpit.queue.showNoSetup')}
        </Button>
      </div>
      {displayFilters && (
        <div className="flex flex-wrap gap-1" role="group" aria-label={t('cockpit.review.candidatesTitle')}>
          {[true, false].map((recommendedOnly) => {
            const active = !hasSavedActionFilter && recommendedOnly === displayFilters.recommendedOnly;
            return (
              <Button key={String(recommendedOnly)} type="button" size="sm"
                variant={active ? 'secondary' : 'ghost'}
                aria-pressed={active}
                onClick={() => setDisplayFilters({ recommendedOnly, actionFilter: 'all' })}>
                {t(recommendedOnly ? 'todayPage.actionList.readyFilter' : 'todayPage.actionList.allSourceCandidates')}
              </Button>
            );
          })}
        </div>
      )}
      {hasSavedActionFilter ? <p className="px-1 text-xs text-muted">{t('cockpit.queue.savedFilter')}</p> : null}
      {groups.length === 0 ? <div className="space-y-2 rounded border border-border p-3 text-sm text-muted">
        <p role="status">{t(!result ? 'screener.quality.unavailable' : candidates.length === 0
          ? 'screener.quality.noMatches' : 'screener.quality.noFilterMatches')}</p>
        {candidates.length > 0 ? <button type="button" className="text-primary underline"
          onClick={() => {
            setQuery('');
            setShowNoSetup(true);
            if (displayFilters) setDisplayFilters({ recommendedOnly: false, actionFilter: 'all' });
          }}>{t('screener.quality.clearFilters')}</button> : null}
      </div> : null}
      {groups.map((group) => (
        <section key={group.status} aria-label={t(group.labelKey)} className="flex flex-col gap-1.5">
          <h3 className={`px-1 pt-1 text-xs font-semibold uppercase tracking-wide ${TONE_TEXT_CLASS[group.presentation.tone]}`}>
            {`${t(group.labelKey)} (${group.candidates.length})`}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {group.candidates.map((candidate) => {
              const ticker = candidate.ticker.trim().toUpperCase();
              const canReviewOrder = Boolean(getCanonicalOrderDraft(candidate));
              const selected = selectedRowId === rowIdFor(ticker);
              const nextStepId = `${descriptionId}-${encodeURIComponent(ticker)}`;
              return (
                <li
                  key={candidate.ticker}
                  className={cn('flex flex-wrap items-center gap-x-1 rounded-lg border bg-background/60 p-1',
                    selected ? 'border-primary/60 bg-primary/10' : 'border-border hover:border-primary/40')}
                >
                  <button
                    type="button"
                    onClick={() => handleSelect(candidate)}
                    aria-label={`${t('cockpit.queue.details')} ${ticker}`}
                    aria-describedby={nextStepId}
                    aria-current={selected || undefined}
                    className="flex min-h-11 min-w-0 flex-1 basis-40 items-center gap-2 rounded-md px-2 py-2 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="break-all text-sm font-semibold text-foreground">{ticker}</span>
                        {candidate.name ? <span className="break-words text-xs text-muted">{candidate.name}</span> : null}
                        {candidate.sameSymbol?.mode === 'ADD_ON' || candidate.sameSymbol?.mode === 'SCALE_BACK' ? (
                          <span className="text-xs text-primary">{t('todayPage.actionList.addOn')}</span>
                        ) : null}
                      </span>
                      <span id={nextStepId} className="mt-1 block break-words text-xs text-muted">
                        {formatWorkflowNextStep(candidate.recommendation?.nextStep)}
                      </span>
                    </span>
                    {candidate.rr != null && candidate.rr > 0 ? (
                      <span title={t('cockpit.queue.rewardRiskLabel')} className="shrink-0 rounded bg-primary/10 px-2 py-1 text-xs text-primary">
                        {t('cockpit.queue.rewardRisk', { value: formatNumber(candidate.rr, 1) })}
                      </span>
                    ) : null}
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  </button>
                  {canReviewOrder ? (
                    <button
                      type="button"
                      onClick={() => handleSelect(candidate, true)}
                      disabled={isRefreshing}
                      aria-label={`${t('cockpit.queue.reviewOrder')} ${ticker}`}
                      className="min-h-11 rounded-md px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
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
