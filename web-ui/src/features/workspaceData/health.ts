import type { WorkspaceHealth, WorkspaceSourceState } from './types';

export function aggregateWorkspaceHealth(states: WorkspaceSourceState[]): WorkspaceHealth {
  const active = states.filter((state) => state.phase !== 'idle');
  if (active.length > 0 && active.every((state) => state.phase === 'failed')) return 'failed';
  if (active.some((state) => state.phase === 'partial' || state.phase === 'failed')) return 'partial';
  if (active.some((state) => state.phase === 'stale')) return 'stale';
  if (active.some((state) => state.phase === 'cached' || state.phase === 'loading')) return 'mixed';
  return 'fresh';
}

export function isIntelligenceOutdated(
  intelligenceGeneratedAt: string | null,
  dependencies: Array<string | null>,
): boolean {
  const availableDependencies = dependencies.filter(
    (timestamp): timestamp is string => timestamp !== null,
  );
  if (availableDependencies.length === 0) return false;
  if (intelligenceGeneratedAt === null) return true;

  const generatedAt = Date.parse(intelligenceGeneratedAt);
  return availableDependencies.some((timestamp) => Date.parse(timestamp) > generatedAt);
}
