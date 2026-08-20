import { describe, expect, it } from 'vitest';
import { aggregateWorkspaceHealth, isIntelligenceOutdated } from './health';
import type {
  WorkspaceSourceId,
  WorkspaceSourcePhase,
  WorkspaceSourceState,
} from './types';

function sourceState(id: WorkspaceSourceId, phase: WorkspaceSourcePhase): WorkspaceSourceState {
  return {
    id,
    ticker: 'AAPL',
    selectionVersion: 1,
    phase,
    provider: null,
    dataAsOf: null,
    fetchedAt: null,
    cacheOrigin: null,
    missingInputs: [],
    error: null,
  };
}

describe('aggregateWorkspaceHealth', () => {
  it.each([
    [['fresh', 'fresh'], 'fresh'],
    [['fresh', 'cached'], 'mixed'],
    [['fresh', 'stale'], 'stale'],
    [['fresh', 'partial'], 'partial'],
    [['fresh', 'failed'], 'partial'],
    [['failed', 'failed'], 'failed'],
  ] as const)('aggregates %j as %s', (phases, expected) => {
    const states = phases.map((phase, index) =>
      sourceState(index === 0 ? 'screener' : 'fundamentals', phase),
    );
    expect(aggregateWorkspaceHealth(states)).toBe(expected);
  });

  it('ignores idle sources when aggregating health', () => {
    expect(
      aggregateWorkspaceHealth([
        sourceState('screener', 'fresh'),
        sourceState('fundamentals', 'idle'),
      ]),
    ).toBe('fresh');
  });
});

describe('isIntelligenceOutdated', () => {
  it('marks intelligence outdated when a dependency is newer', () => {
    expect(
      isIntelligenceOutdated('2026-07-27T18:00:00Z', [
        '2026-07-27T17:00:00Z',
        '2026-07-27T19:00:00Z',
      ]),
    ).toBe(true);
  });

  it('keeps intelligence current when all available dependencies are older', () => {
    expect(
      isIntelligenceOutdated('2026-07-27T18:00:00Z', [
        '2026-07-27T17:00:00Z',
        null,
      ]),
    ).toBe(false);
  });

  it('treats dependencies as outdated when intelligence has not been generated', () => {
    expect(isIntelligenceOutdated(null, ['2026-07-27T17:00:00Z'])).toBe(true);
  });
});
