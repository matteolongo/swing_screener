import { useEffect, useState } from 'react';

import type { WorkspaceSourceId, WorkspaceSourceState } from '@/features/workspaceData/types';
import { t } from '@/i18n/t';

interface WorkspaceActivityDrawerProps {
  activities: WorkspaceSourceState[];
  onRetry?: (sourceId: WorkspaceSourceId) => void;
  onDismiss?: (sourceId: WorkspaceSourceId) => void;
}

export default function WorkspaceActivityDrawer({
  activities,
  onRetry,
  onDismiss,
}: WorkspaceActivityDrawerProps) {
  const [retainedFailures, setRetainedFailures] = useState<WorkspaceSourceState[]>(() =>
    activities.filter(({ phase, error }) => phase === 'failed' && error),
  );
  const hasNewFailure = activities.some(({ phase, error }) => phase === 'failed' && error);

  useEffect(() => {
    setRetainedFailures((current) => {
      const next = new Map(current.map((activity) => [activity.id, activity]));
      for (const activity of activities) {
        if (activity.phase === 'failed' && activity.error) next.set(activity.id, activity);
        else if (activity.phase === 'fresh' || activity.phase === 'cached') next.delete(activity.id);
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
  }, [activities]);

  function dismiss(sourceId: WorkspaceSourceId) {
    setRetainedFailures((current) => current.filter(({ id }) => id !== sourceId));
    onDismiss?.(sourceId);
  }

  if (retainedFailures.length === 0) return null;

  return (
    <aside
      className="shrink-0 rounded-md border border-danger/40 bg-danger/10 p-3"
      role={hasNewFailure ? 'alert' : 'status'}
      aria-label={t('workspacePage.data.activity')}
    >
      <ul className="space-y-2">
        {retainedFailures.map((activity) => (
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
