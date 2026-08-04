import { describe, expect, it } from 'vitest';

import { limitActivities, prependActivity, settleActivity } from './activity';
import type { WorkspaceActivity } from './types';

function activity(
  requestId: string,
  startedAt: string,
  overrides: Partial<WorkspaceActivity> = {},
): WorkspaceActivity {
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
    ...overrides,
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
    expect(limitActivities(records, 20)[19]?.requestId).toBe('19');
  });

  it('reserves the full history limit for the active symbol session', () => {
    const prior = Array.from({ length: 20 }, (_, index) => activity(
      `old-${index}`,
      `2026-07-29T08:${String(index).padStart(2, '0')}:00Z`,
      { ticker: 'MSFT', selectionVersion: 1 },
    ));
    let records = prior;

    for (let index = 0; index < 21; index += 1) {
      records = prependActivity(records, activity(
        `current-${index}`,
        `2026-07-29T09:${String(index).padStart(2, '0')}:00Z`,
        { selectionVersion: 2 },
      ));
    }

    expect(records.filter(({ ticker }) => ticker === 'AAPL')).toHaveLength(20);
    expect(records.filter(({ ticker }) => ticker === 'MSFT')).toHaveLength(20);
  });

  it('supersedes an older failure after the same source succeeds', () => {
    const failed = {
      ...activity('failed', '2026-07-29T08:00:00Z'),
      phase: 'failed' as const,
    };
    const active = activity('retry', '2026-07-29T09:00:00Z');

    const records = settleActivity([active, failed], 'retry', {
      phase: 'completed',
      finishedAt: '2026-07-29T09:01:00Z',
    });

    expect(records).toEqual([
      expect.objectContaining({ requestId: 'retry', phase: 'completed' }),
    ]);
  });

  it('keeps a failure from another pipeline step of the same source', () => {
    const failed = {
      ...activity('positions-failed', '2026-07-29T08:00:00Z', {
        sourceId: 'positionOrders',
        pipelineStep: 'fetch-positions',
      }),
      phase: 'failed' as const,
    };
    const active = activity('orders-success', '2026-07-29T09:00:00Z', {
      sourceId: 'positionOrders',
      pipelineStep: 'fetch-orders',
    });

    const records = settleActivity([active, failed], 'orders-success', {
      phase: 'completed',
      finishedAt: '2026-07-29T09:01:00Z',
    });

    expect(records).toEqual([
      expect.objectContaining({ requestId: 'orders-success', phase: 'completed' }),
      expect.objectContaining({ requestId: 'positions-failed', phase: 'failed' }),
    ]);
  });

  it('treats the legacy candle step as the prices pipeline when superseding', () => {
    const failed = {
      ...activity('legacy-prices-failed', '2026-07-29T08:00:00Z', {
        pipelineStep: 'fetch-candles',
      }),
      phase: 'failed' as const,
    };
    const active = activity('prices-success', '2026-07-29T09:00:00Z', {
      pipelineStep: 'fetch-prices',
    });

    const records = settleActivity([active, failed], 'prices-success', {
      phase: 'completed',
      finishedAt: '2026-07-29T09:01:00Z',
    });

    expect(records).toHaveLength(1);
  });

  it('supersedes a failed fundamentals fetch after its explicit retry succeeds', () => {
    const failed = {
      ...activity('fundamentals-failed', '2026-07-29T08:00:00Z', {
        sourceId: 'fundamentals',
        pipelineStep: 'fetch-fundamentals',
      }),
      phase: 'failed' as const,
    };
    const active = activity('fundamentals-retry', '2026-07-29T09:00:00Z', {
      sourceId: 'fundamentals',
      pipelineStep: 'refresh-fundamentals',
    });

    const records = settleActivity([active, failed], 'fundamentals-retry', {
      phase: 'completed',
      finishedAt: '2026-07-29T09:01:00Z',
    });

    expect(records).toEqual([
      expect.objectContaining({ requestId: 'fundamentals-retry', phase: 'completed' }),
    ]);
  });
});
