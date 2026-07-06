import { describe, expect, it } from 'vitest';

import { transformRunTrace, transformRunIndexEntry, type RunTraceAPI } from '@/features/intelligence/traceTypes';

const apiTrace: RunTraceAPI = {
  run_id: 'r1',
  ticker: 'AAPL',
  started_at: '2026-07-05T10:00:00+00:00',
  finished_at: '2026-07-05T10:00:02+00:00',
  status: 'ok',
  error: null,
  steps: [
    {
      name: 'search',
      status: 'ok',
      started_at: '2026-07-05T10:00:00+00:00',
      finished_at: '2026-07-05T10:00:01+00:00',
      duration_ms: 1000,
      outputs_summary: { search_chars: 42 },
      error: null,
      model: 'gpt-4o',
      tokens: 1000,
      source_counts: { polygon_news: 2 },
      prompt_hash: null,
      prompt_preview: null,
    },
  ],
};

describe('transformRunTrace', () => {
  it('maps snake_case to camelCase', () => {
    const t = transformRunTrace(apiTrace);
    expect(t.runId).toBe('r1');
    expect(t.steps[0].durationMs).toBe(1000);
    expect(t.steps[0].sourceCounts).toEqual({ polygon_news: 2 });
    expect(t.steps[0].model).toBe('gpt-4o');
  });

  it('maps index entry', () => {
    const e = transformRunIndexEntry({
      run_id: 'r1',
      ticker: 'AAPL',
      started_at: '2026-07-05T10:00:00+00:00',
      finished_at: null,
      status: 'ok',
      duration_ms: 1200,
      step_count: 9,
    });
    expect(e.runId).toBe('r1');
    expect(e.stepCount).toBe(9);
    expect(e.durationMs).toBe(1200);
  });
});
