import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';

import { server } from '@/test/mocks/server';
import { API_BASE_URL } from '@/lib/api';
import { renderWithProviders, screen, waitFor } from '@/test/utils';
import { t } from '@/i18n/t';
import AgentTracePanel from './AgentTracePanel';

const KEY = 'workspacePage.panels.analysis.intelligence.agentTrace';

function step(overrides: Record<string, unknown> = {}) {
  return {
    name: 'search',
    status: 'ok',
    started_at: '2026-07-05T10:00:00+00:00',
    finished_at: '2026-07-05T10:00:01+00:00',
    duration_ms: 1000,
    outputs_summary: {},
    error: null,
    model: null,
    tokens: null,
    source_counts: null,
    prompt_hash: null,
    prompt_preview: null,
    ...overrides,
  };
}

function trace(steps: Array<Record<string, unknown>>) {
  return {
    run_id: 'r1',
    ticker: 'AAPL',
    started_at: '2026-07-05T10:00:00+00:00',
    finished_at: '2026-07-05T10:00:02+00:00',
    status: 'ok',
    error: null,
    steps,
  };
}

describe('AgentTracePanel', () => {
  it('renders a run header and friendly step labels', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/intelligence/runs/r1`, () =>
        HttpResponse.json(trace([step({ outputs_summary: { search_chars: 42 }, model: 'gpt-4o', tokens: 1000 })])),
      ),
    );

    renderWithProviders(<AgentTracePanel runId="r1" />);

    await waitFor(() => expect(screen.getByText(t(`${KEY}.stepLabels.search`))).toBeInTheDocument());
    // Run header: overall status + step count.
    expect(screen.getByText(t(`${KEY}.status.ok`))).toBeInTheDocument();
    expect(screen.getByText(t(`${KEY}.run.stepCount`, { count: 1 }))).toBeInTheDocument();
  });

  it('only shows detail tabs the selected step actually populated', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/intelligence/runs/r-tabs`, () =>
        HttpResponse.json(
          trace([
            step({
              name: 'search',
              outputs_summary: {},
              model: 'gpt-4o',
              tokens: 1234,
              source_counts: { 'example.com': 2 },
              prompt_hash: 'abc123',
              prompt_preview: 'preview text',
            }),
          ]),
        ),
      ),
    );

    const { user } = renderWithProviders(<AgentTracePanel runId="r-tabs" />);

    await waitFor(() => expect(screen.getByText(t(`${KEY}.stepLabels.search`))).toBeInTheDocument());

    // outputs_summary is empty, so there is no Data tab; default lands on Sources.
    expect(screen.queryByRole('tab', { name: t(`${KEY}.tabs.data`) })).not.toBeInTheDocument();
    expect(screen.getByText(/example\.com/)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: t(`${KEY}.tabs.prompt`) }));
    expect(screen.getByText('abc123')).toBeInTheDocument();
    expect(screen.getByText('preview text')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: t(`${KEY}.tabs.model`) }));
    expect(screen.getByText('gpt-4o')).toBeInTheDocument();
    expect(screen.getByText('1234')).toBeInTheDocument();
  });

  it('shows the only-timing message for a step with no captured detail, and resets tab per step', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/intelligence/runs/r-sparse`, () =>
        HttpResponse.json(
          trace([
            step({ name: 'enrich_polygon', duration_ms: 0.4, outputs_summary: { close: 190.5 } }),
            step({ name: 'resolve_context', duration_ms: 5, outputs_summary: {} }),
            step({ name: 'format', duration_ms: 1000, outputs_summary: {}, status: 'error', error: 'boom' }),
          ]),
        ),
      ),
    );

    const { user } = renderWithProviders(<AgentTracePanel runId="r-sparse" />);

    // enrich_polygon: only outputs → Data tab shows the recorded close, no Sources tab.
    await waitFor(() => expect(screen.getByText(t(`${KEY}.stepLabels.enrich_polygon`))).toBeInTheDocument());
    expect(screen.getByText(/190\.5/)).toBeInTheDocument();
    // Sub-millisecond duration renders as the "<1 ms" sentinel, not "0 ms".
    expect(screen.getByText(t(`${KEY}.subMs`))).toBeInTheDocument();

    // resolve_context recorded nothing → only-timing message, no tabs.
    await user.click(screen.getByText(t(`${KEY}.stepLabels.resolve_context`)));
    expect(screen.getByText(t(`${KEY}.onlyTiming`))).toBeInTheDocument();

    // format failed → Errors is the only tab and opens by default, showing the message.
    await user.click(screen.getByText(t(`${KEY}.stepLabels.format`)));
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('surfaces a run-level error', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/intelligence/runs/r-runerr`, () =>
        HttpResponse.json({ ...trace([]), status: 'error', error: 'graph exploded' }),
      ),
    );

    renderWithProviders(<AgentTracePanel runId="r-runerr" />);

    await waitFor(() => expect(screen.getByText(/graph exploded/)).toBeInTheDocument());
    expect(screen.getByText(t(`${KEY}.noSteps`))).toBeInTheDocument();
  });

  it('shows empty state when runId is null', () => {
    renderWithProviders(<AgentTracePanel runId={null} />);
    expect(screen.getByText(t(`${KEY}.empty`))).toBeInTheDocument();
  });

  it('shows loading copy while the trace request is pending', () => {
    server.use(
      http.get(`${API_BASE_URL}/api/intelligence/runs/r-loading`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json(trace([step()]));
      }),
    );

    renderWithProviders(<AgentTracePanel runId="r-loading" />);
    expect(screen.getByText(t(`${KEY}.loading`))).toBeInTheDocument();
  });

  it('shows error copy when the trace request fails', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/intelligence/runs/r-error`, () => new HttpResponse(null, { status: 500 })),
    );

    renderWithProviders(<AgentTracePanel runId="r-error" />);

    await waitFor(() => expect(screen.getByText(t(`${KEY}.error`))).toBeInTheDocument());
  });
});
