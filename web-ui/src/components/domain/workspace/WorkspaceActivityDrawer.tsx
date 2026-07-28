import { useEffect, useRef, useState } from 'react';

import type { WorkspaceSourceId, WorkspaceSourceState } from '@/features/workspaceData/types';
import { t } from '@/i18n/t';

interface WorkspaceActivityDrawerProps {
  activities: WorkspaceSourceState[];
  onRetry?: (sourceId: WorkspaceSourceId) => void;
  onDismiss?: (sourceId: WorkspaceSourceId) => void;
  selectedSourceId?: WorkspaceSourceId | null;
}

export default function WorkspaceActivityDrawer({
  activities,
  onRetry,
  onDismiss,
  selectedSourceId = null,
}: WorkspaceActivityDrawerProps) {
  const incomingSelection = activities[0]
    ? `${activities[0].ticker}:${activities[0].selectionVersion}`
    : null;
  const selectionRef = useRef(incomingSelection);
  const [retainedFailures, setRetainedFailures] = useState<WorkspaceSourceState[]>(() =>
    activities.filter(({ phase, error }) => (phase === 'failed' || phase === 'partial') && error),
  );
  const [dismissedFailures, setDismissedFailures] = useState<Set<string>>(() => new Set());
  const hasNewFailure = activities.some(
    ({ phase, error }) => (phase === 'failed' || phase === 'partial') && error,
  );

  useEffect(() => {
    if (incomingSelection && incomingSelection !== selectionRef.current) {
      selectionRef.current = incomingSelection;
      setRetainedFailures([]);
      setDismissedFailures(new Set());
    }

    setRetainedFailures((current) => {
      const next = new Map(
        current
          .filter(
            ({ ticker, selectionVersion }) =>
              `${ticker}:${selectionVersion}` === selectionRef.current,
          )
          .map((activity) => [activity.id, activity]),
      );
      for (const activity of activities) {
        const failureIdentity = `${activity.ticker}:${activity.selectionVersion}:${activity.id}:${activity.error?.message ?? ''}`;
        if (
          (activity.phase === 'failed' || activity.phase === 'partial') &&
          activity.error &&
          !dismissedFailures.has(failureIdentity)
        ) {
          next.set(activity.id, activity);
        } else if (activity.phase === 'fresh' || activity.phase === 'cached') {
          next.delete(activity.id);
        }
      }
      const updated = [...next.values()];
      const unchanged =
        updated.length === current.length &&
        updated.every(
          (activity, index) =>
            activity.id === current[index]?.id &&
            activity.phase === current[index]?.phase &&
            activity.error?.message === current[index]?.error?.message,
        );
      return unchanged ? current : updated;
    });
    setDismissedFailures((current) => {
      const recoveredSources = new Set(
        activities
          .filter(({ phase }) => phase === 'fresh' || phase === 'cached')
          .map(({ ticker, selectionVersion, id }) => `${ticker}:${selectionVersion}:${id}:`),
      );
      if (recoveredSources.size === 0) return current;
      const updated = new Set(
        [...current].filter(
          (identity) => ![...recoveredSources].some((prefix) => identity.startsWith(prefix)),
        ),
      );
      return updated.size === current.size ? current : updated;
    });
  }, [activities, dismissedFailures, incomingSelection]);

  function dismiss(sourceId: WorkspaceSourceId) {
    const activity = retainedFailures.find(({ id }) => id === sourceId);
    if (activity?.error) {
      setDismissedFailures((current) => {
        const updated = new Set(current);
        updated.add(
          `${activity.ticker}:${activity.selectionVersion}:${activity.id}:${activity.error?.message ?? ''}`,
        );
        return updated;
      });
    }
    setRetainedFailures((current) => current.filter(({ id }) => id !== sourceId));
    onDismiss?.(sourceId);
  }

  const visibleFailures = retainedFailures.filter(
    ({ ticker, selectionVersion }) =>
      !incomingSelection || `${ticker}:${selectionVersion}` === incomingSelection,
  );

  const selectedActivity = activities.find(({ id }) => id === selectedSourceId);
  if (visibleFailures.length === 0 && !selectedActivity) return null;

  return (
    <aside
      className="shrink-0 rounded-md border border-danger/40 bg-danger/10 p-3"
      role={hasNewFailure ? 'alert' : 'status'}
      aria-label={t('workspacePage.data.activity')}
    >
      {selectedActivity ? (
        <div className="mb-2 text-xs text-foreground" data-testid="workspace-source-detail">
          <div className="font-semibold">
            {t(`workspacePage.data.sources.${selectedActivity.id}`)}
            {' · '}
            {t(`workspacePage.data.phases.${selectedActivity.phase}`)}
          </div>
          <dl className="mt-2 grid gap-1 sm:grid-cols-2">
            {[
              ['provider', selectedActivity.provider],
              ['dataAsOf', selectedActivity.dataAsOf],
              ['fetchedAt', selectedActivity.fetchedAt
                ? new Date(selectedActivity.fetchedAt).toLocaleString()
                : null],
              ['cacheOrigin', selectedActivity.cacheOrigin],
              ['missingInputs', selectedActivity.missingInputs.length
                ? selectedActivity.missingInputs.map((input) =>
                    input === 'positions' || input === 'orders'
                      ? t(`workspacePage.data.details.inputs.${input}`)
                      : input,
                  ).join(', ')
                : t('workspacePage.data.details.none')],
              ['diagnostics', selectedActivity.error?.message],
            ].map(([key, value]) => (
              <div key={key}>
                <dt className="text-muted">
                  {t(`workspacePage.data.details.${key}` as Parameters<typeof t>[0])}
                </dt>
                <dd>{value || t('workspacePage.data.details.unavailable')}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
      <ul className="space-y-2">
        {visibleFailures.map((activity) => (
          <li key={activity.id} className="flex items-center gap-2 text-xs text-danger">
            <span className="min-w-0 flex-1">{activity.error?.message}</span>
            {activity.error?.retryable && onRetry ? (
              <button
                type="button"
                className="rounded border border-danger/40 px-2 py-1 font-medium"
                onClick={() => onRetry(activity.id)}
              >
                {t('workspacePage.data.retry')}
              </button>
            ) : null}
            <button
              type="button"
              className="rounded px-2 py-1 font-medium"
              onClick={() => dismiss(activity.id)}
            >
              {t('workspacePage.data.dismiss')}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
