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

  it('shows loading copy while the trace request is pending', () => {
    server.use(
      http.get(`${API_BASE_URL}/api/intelligence/runs/r-loading`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json(trace);
      }),
    );

    renderWithProviders(<AgentTracePanel runId="r-loading" />);

    expect(
      screen.getByText(t('workspacePage.panels.analysis.intelligence.agentTrace.loading')),
    ).toBeInTheDocument();
  });

  it('shows error copy when the trace request fails', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/intelligence/runs/r-error`, () => new HttpResponse(null, { status: 500 })),
    );

    renderWithProviders(<AgentTracePanel runId="r-error" />);

    await waitFor(() =>
      expect(
        screen.getByText(t('workspacePage.panels.analysis.intelligence.agentTrace.error')),
      ).toBeInTheDocument(),
    );
  });

  it('exercises the sources/prompt/model/errors tabs for populated and sparse steps', async () => {
    const twoStepTrace = {
      run_id: 'r-multi',
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
          outputs_summary: {},
          error: null,
          model: 'gpt-4o',
          tokens: 1234,
          source_counts: { polygon_news: 2 },
          prompt_hash: 'abc123',
          prompt_preview: 'preview text',
        },
        {
          name: 'summarize',
          status: 'ok',
          started_at: '2026-07-05T10:00:01+00:00',
          finished_at: '2026-07-05T10:00:02+00:00',
          duration_ms: 500,
          inputs_summary: {},
          outputs_summary: {},
          error: 'boom',
          model: null,
          tokens: null,
          source_counts: null,
          prompt_hash: null,
          prompt_preview: null,
        },
      ],
    };

    server.use(
      http.get(`${API_BASE_URL}/api/intelligence/runs/r-multi`, () => HttpResponse.json(twoStepTrace)),
    );

    const { user } = renderWithProviders(<AgentTracePanel runId="r-multi" />);

    await waitFor(() => expect(screen.getByText('search')).toBeInTheDocument());

    // Step A ("search") is selected by default — walk through its tabs.
    await user.click(screen.getByText(t('workspacePage.panels.analysis.intelligence.agentTrace.tabs.sources')));
    expect(screen.getByText(/polygon_news/)).toBeInTheDocument();

    await user.click(screen.getByText(t('workspacePage.panels.analysis.intelligence.agentTrace.tabs.prompt')));
    expect(screen.getByText('abc123')).toBeInTheDocument();
    expect(screen.getByText('preview text')).toBeInTheDocument();

    await user.click(screen.getByText(t('workspacePage.panels.analysis.intelligence.agentTrace.tabs.model')));
    expect(screen.getByText('gpt-4o')).toBeInTheDocument();
    expect(screen.getByText('1234')).toBeInTheDocument();

    await user.click(screen.getByText(t('workspacePage.panels.analysis.intelligence.agentTrace.tabs.errors')));
    expect(
      screen.getByText(t('workspacePage.panels.analysis.intelligence.agentTrace.fields.noError')),
    ).toBeInTheDocument();

    // Switch to step B ("summarize") — the errors tab stays selected (StepDetail keeps its own
    // state across step switches), so the "boom" error is visible immediately.
    await user.click(screen.getByText('summarize'));
    expect(screen.getByText('boom')).toBeInTheDocument();

    await user.click(screen.getByText(t('workspacePage.panels.analysis.intelligence.agentTrace.tabs.model')));
    expect(
      screen.getAllByText('—').length,
    ).toBeGreaterThanOrEqual(2); // model and tokens both fall back to the sentinel

    await user.click(screen.getByText(t('workspacePage.panels.analysis.intelligence.agentTrace.tabs.sources')));
    expect(
      screen.getByText(t('workspacePage.panels.analysis.intelligence.agentTrace.fields.noSources')),
    ).toBeInTheDocument();

    await user.click(screen.getByText(t('workspacePage.panels.analysis.intelligence.agentTrace.tabs.prompt')));
    expect(
      screen.getByText(t('workspacePage.panels.analysis.intelligence.agentTrace.fields.noPrompt')),
    ).toBeInTheDocument();
  });
});
