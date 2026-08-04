import { describe, expect, it } from 'vitest';

import { limitActivities, prependActivity, settleActivity } from './activity';
import type { WorkspaceActivity } from './types';

function activity(requestId: string, startedAt: string): WorkspaceActivity {
  return {
    requestId,
    ticker: 'aapl',
    selectionVersion: 1,
    sourceId: 'prices',
    phase: 'active',
    startedAt,
    finishedAt: null,
    provider: null,
    message: null,
    retryable: false,
    pipelineStep: null,
    announced: false,
  };
}

describe('workspace activity lifecycle', () => {
  it('normalizes and inserts active requests newest-first', () => {
    const records = prependActivity(
      [activity('older', '2026-07-29T08:00:00Z')],
      activity('newer', '2026-07-29T09:00:00Z'),
    );

    expect(records.map(({ requestId }) => requestId)).toEqual(['newer', 'older']);
    expect(records[0]).toMatchObject({ ticker: 'AAPL', phase: 'active' });
  });

  it('settles only the matching request ID', () => {
    const records = [
      activity('newer', '2026-07-29T09:00:00Z'),
      activity('older', '2026-07-29T08:00:00Z'),
    ];

    const settled = settleActivity(records, 'older', {
      phase: 'failed',
      finishedAt: '2026-07-29T09:01:00Z',
      message: 'Provider unavailable',
      retryable: true,
    });

    expect(settled[0]).toEqual(records[0]);
    expect(settled[1]).toMatchObject({
      requestId: 'older',
      phase: 'failed',
      message: 'Provider unavailable',
    });
  });

  it('caps retained request history', () => {
    const records = Array.from({ length: 25 }, (_, index) =>
      activity(String(index), `2026-07-29T09:${String(index).padStart(2, '0')}:00Z`));

    expect(limitActivities(records, 20)).toHaveLength(20);
    expect(limitActivities(records, 20).at(-1)?.requestId).toBe('19');
  });
});
