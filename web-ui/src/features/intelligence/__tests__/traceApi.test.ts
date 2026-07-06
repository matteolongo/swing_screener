import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';

import { server } from '@/test/mocks/server';
import { API_BASE_URL } from '@/lib/api';
import { getRunTrace, getTickerRuns } from '@/features/intelligence/api';

describe('intelligence api — run trace transform seam', () => {
  it('getRunTrace fetches a snake_case RunTrace and returns it transformed to camelCase', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/intelligence/runs/r1`, () =>
        HttpResponse.json({
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
              inputs_summary: {},
              outputs_summary: { search_chars: 42 },
              error: null,
              model: 'gpt-4o',
              tokens: 1000,
              source_counts: { polygon_news: 2 },
              prompt_hash: 'abc123',
              prompt_preview: 'Analyze AAPL...',
            },
          ],
        }),
      ),
    );

    const trace = await getRunTrace('r1');

    expect(trace.runId).toBe('r1');
    expect(trace.steps[0].durationMs).toBe(1000);
    expect(trace.steps[0].sourceCounts).toEqual({ polygon_news: 2 });
    expect(trace.steps[0].promptHash).toBe('abc123');
  });

  it('getTickerRuns fetches the { entries } envelope and returns a transformed camelCase array', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/intelligence/AAPL/runs`, () =>
        HttpResponse.json({
          entries: [
            {
              run_id: 'r1',
              ticker: 'AAPL',
              started_at: '2026-07-05T10:00:00+00:00',
              finished_at: '2026-07-05T10:00:02+00:00',
              status: 'ok',
              duration_ms: 2000,
              step_count: 3,
            },
          ],
        }),
      ),
    );

    const runs = await getTickerRuns('AAPL');

    expect(runs).toHaveLength(1);
    expect(runs[0].runId).toBe('r1');
    expect(runs[0].stepCount).toBe(3);
    expect(runs[0].durationMs).toBe(2000);
  });
});
