import type {
  WorkspaceActivity,
  WorkspaceActivitySettlement,
} from './types';

export const WORKSPACE_ACTIVITY_LIMIT = 20;

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
  return limitActivities([
    normalized,
    ...activities.filter(({ requestId }) => requestId !== normalized.requestId),
  ]);
}

export function settleActivity(
  activities: WorkspaceActivity[],
  requestId: string,
  settlement: WorkspaceActivitySettlement,
): WorkspaceActivity[] {
  return activities.map((activity) =>
    activity.requestId === requestId
      ? { ...activity, ...settlement }
      : activity);
}
