import type {
  WorkspaceActivity,
  WorkspaceActivitySettlement,
} from './types';

export const WORKSPACE_ACTIVITY_LIMIT = 20;

function pipelineKey(pipelineStep: string | null): string | null {
  if (pipelineStep === 'fetch-candles') return 'fetch-prices';
  if (pipelineStep === 'fetch-fundamentals') return 'refresh-fundamentals';
  return pipelineStep;
}

export function limitActivities(
  activities: WorkspaceActivity[],
  limit = WORKSPACE_ACTIVITY_LIMIT,
): WorkspaceActivity[] {
  return activities.slice(0, Math.max(0, limit));
}

export function prependActivity(
  activities: WorkspaceActivity[],
  activity: WorkspaceActivity,
): WorkspaceActivity[] {
  const normalized = {
    ...activity,
    ticker: activity.ticker.trim().toUpperCase(),
    phase: 'active' as const,
    finishedAt: null,
  };
  const retained = activities.filter(({ requestId }) => requestId !== normalized.requestId);
  const isCurrentSession = (candidate: WorkspaceActivity) =>
    candidate.ticker === normalized.ticker
    && candidate.selectionVersion === normalized.selectionVersion;
  const currentSession = [normalized, ...retained.filter(isCurrentSession)]
    .slice(0, WORKSPACE_ACTIVITY_LIMIT);
  const priorSessions = retained.filter((candidate) => !isCurrentSession(candidate))
    .slice(0, WORKSPACE_ACTIVITY_LIMIT);
  return [...currentSession, ...priorSessions];
}

export function settleActivity(
  activities: WorkspaceActivity[],
  requestId: string,
  settlement: WorkspaceActivitySettlement,
): WorkspaceActivity[] {
  const settled = activities.map((activity) =>
    activity.requestId === requestId
      ? { ...activity, ...settlement }
      : activity);
  const completed = settled.find((activity) => activity.requestId === requestId);
  if (completed?.phase !== 'completed') return settled;
  return settled.filter((activity) =>
    activity.requestId === requestId
    || activity.phase !== 'failed'
    || activity.ticker !== completed.ticker
    || activity.selectionVersion !== completed.selectionVersion
    || activity.sourceId !== completed.sourceId
    || pipelineKey(activity.pipelineStep) !== pipelineKey(completed.pipelineStep));
}
