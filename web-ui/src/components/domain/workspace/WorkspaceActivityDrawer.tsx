import { useEffect } from 'react';

import type {
  WorkspaceActivity,
  WorkspaceSourceId,
  WorkspaceSourceState,
} from '@/features/workspaceData/types';
import { t } from '@/i18n/t';

interface WorkspaceActivityDrawerProps {
  activities: WorkspaceActivity[];
  onRetry?: (sourceId: WorkspaceSourceId) => void;
  onDismiss?: (requestId: string) => void;
  onMarkAnnounced?: (requestId: string) => void;
  selectedSource?: WorkspaceSourceState | null;
}

function pipelineStepLabel(step: string): string {
  switch (step) {
    case 'fetch-prices':
    case 'fetch-candles':
      return t('workspacePage.data.pipelineSteps.fetchPrices');
    case 'fetch-fundamentals':
      return t('workspacePage.data.pipelineSteps.fetchFundamentals');
    case 'fetch-evidence':
      return t('workspacePage.data.pipelineSteps.fetchEvidence');
    case 'fetch-intelligence':
      return t('workspacePage.data.pipelineSteps.fetchIntelligence');
    case 'fetch-positions':
      return t('workspacePage.data.pipelineSteps.fetchPositions');
    case 'fetch-orders':
      return t('workspacePage.data.pipelineSteps.fetchOrders');
    case 'refresh-fundamentals':
      return t('workspacePage.data.pipelineSteps.refreshFundamentals');
    case 'refresh-evidence':
      return t('workspacePage.data.pipelineSteps.refreshEvidence');
    case 'generate-analysis':
      return t('workspacePage.data.pipelineSteps.generateAnalysis');
    case 'regenerate-analysis':
      return t('workspacePage.data.pipelineSteps.regenerateAnalysis');
    default:
      return t('workspacePage.data.pipelineSteps.unavailable');
  }
}

export default function WorkspaceActivityDrawer({
  activities,
  onRetry,
  onDismiss,
  onMarkAnnounced,
  selectedSource = null,
}: WorkspaceActivityDrawerProps) {
  const unannouncedFailure = activities.find(
    ({ phase, announced }) => phase === 'failed' && !announced,
  );

  useEffect(() => {
    if (unannouncedFailure) onMarkAnnounced?.(unannouncedFailure.requestId);
  }, [onMarkAnnounced, unannouncedFailure]);

  if (activities.length === 0 && !selectedSource) return null;

  return (
    <>
      {unannouncedFailure ? (
        <div className="sr-only" role="alert">
          {unannouncedFailure.message ?? t('workspacePage.data.activityFailed')}
        </div>
      ) : null}
      <aside
        className="shrink-0 rounded-md border border-border bg-surface-muted/40 p-3"
        role="status"
        aria-label={t('workspacePage.data.activity')}
      >
        {selectedSource ? (
          <div className="mb-2 text-xs text-foreground" data-testid="workspace-source-detail">
            <div className="font-semibold">
              {t(`workspacePage.data.sources.${selectedSource.id}`)}
              {' · '}
              {t(`workspacePage.data.phases.${selectedSource.phase}`)}
            </div>
            <div className="mt-1 text-muted">
              {selectedSource.provider ?? t('workspacePage.data.details.unavailable')}
              {' · '}
              {selectedSource.dataAsOf ?? t('workspacePage.data.details.unavailable')}
            </div>
          </div>
        ) : null}
        <ul className="space-y-2">
          {activities.map((activity) => (
            <li
              key={activity.requestId}
              className="rounded border border-border/70 bg-surface px-2 py-2 text-xs"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-foreground">
                    {t(`workspacePage.data.sources.${activity.sourceId}`)}
                    {' · '}
                    {t(`workspacePage.data.activityPhases.${activity.phase}`)}
                  </div>
                  <div className="mt-1 text-muted">
                    {activity.ticker}
                    {' · '}
                    {activity.requestId}
                    {activity.provider ? ` · ${activity.provider}` : ''}
                    {activity.pipelineStep ? ` · ${pipelineStepLabel(activity.pipelineStep)}` : ''}
                  </div>
                  {activity.message ? (
                    <div className={activity.phase === 'failed' ? 'mt-1 text-danger' : 'mt-1 text-muted'}>
                      {activity.message}
                    </div>
                  ) : null}
                </div>
                {activity.retryable && onRetry ? (
                  <button
                    type="button"
                    className="rounded border border-danger/40 px-2 py-1 font-medium text-danger"
                    onClick={() => onRetry(activity.sourceId)}
                    aria-label={t('workspacePage.data.retryActivity', {
                      source: t(`workspacePage.data.sources.${activity.sourceId}`),
                      ticker: activity.ticker,
                    })}
                  >
                    {t('workspacePage.data.retry')}
                  </button>
                ) : null}
                {onDismiss ? (
                  <button
                    type="button"
                    className="rounded px-2 py-1 font-medium text-muted"
                    onClick={() => onDismiss(activity.requestId)}
                    aria-label={t('workspacePage.data.dismissActivity', {
                      source: t(`workspacePage.data.sources.${activity.sourceId}`),
                      ticker: activity.ticker,
                    })}
                  >
                    {t('workspacePage.data.dismiss')}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
}
