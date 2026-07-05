import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';

import { server } from '@/test/mocks/server';
import { API_BASE_URL } from '@/lib/api';
import { renderWithProviders, screen, waitFor } from '@/test/utils';
import { t } from '@/i18n/t';
import AgentTracePanel from './AgentTracePanel';

const trace = {
  run_id: 'r1',
  ticker: 'AAPL',
  started_at: '2026-07-05T10:00:00+00:00',
  finished_at: '2026-07-05T10:00:02+00:00',
  status: 'ok',
  cache_hit: false,
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
      prompt_hash: null,
      prompt_preview: null,
    },
  ],
};

describe('AgentTracePanel', () => {
  it('renders the step timeline and switches detail tabs', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/intelligence/runs/r1`, () => HttpResponse.json(trace)),
    );

    const { user } = renderWithProviders(<AgentTracePanel runId="r1" />);

    await waitFor(() => expect(screen.getByText('search')).toBeInTheDocument());

    await user.click(screen.getByText(t('workspacePage.panels.analysis.intelligence.agentTrace.tabs.model')));

    expect(screen.getByText('gpt-4o')).toBeInTheDocument();
  });

  it('shows empty state when runId is null', () => {
    renderWithProviders(<AgentTracePanel runId={null} />);

    expect(
      screen.getByText(t('workspacePage.panels.analysis.intelligence.agentTrace.empty')),
    ).toBeInTheDocument();
  });
});
