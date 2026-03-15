import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpResponse, http } from 'msw';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import Workspace from './Workspace';
import { server } from '@/test/mocks/server';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useScreenerStore } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

function buildCandidateWithThesis(ticker = 'AAPL') {
  return {
    ticker,
    currency: 'USD',
    rank: 1,
    score: 0.95,
    close: 175.5,
    last_bar: '2026-02-18T16:00:00',
    sma_20: 170,
    sma_50: 165,
    sma_200: 160,
    atr: 3.25,
    momentum_6m: 25,
    momentum_12m: 45,
    rel_strength: 85.2,
    confidence: 72.5,
    signal: 'breakout',
    recommendation: {
      verdict: 'RECOMMENDED',
      reasons_short: ['Trend aligned'],
      reasons_detailed: [],
      risk: {
        entry: 175.5,
        stop: 170.0,
        target: 186.0,
        rr: 2.0,
        risk_amount: 20,
        risk_pct: 0.01,
        position_size: 500,
        shares: 2,
        invalidation_level: 170.0,
      },
      costs: {
        commission_estimate: 1,
        fx_estimate: 0,
        slippage_estimate: 0.5,
        total_cost: 1.5,
        fee_to_risk_pct: 0.075,
      },
      checklist: [],
      education: {
        common_bias_warning: 'Avoid overtrading',
        what_to_learn: 'Breakout confirmation',
        what_would_make_valid: ['Close above resistance'],
      },
      thesis: {
        ticker,
        strategy: 'Momentum',
        entry_type: 'Breakout',
        trend_status: 'Uptrend',
        relative_strength: 'Strong',
        regime_alignment: true,
        volatility_state: 'Normal',
        risk_reward: 2.2,
        setup_quality_score: 88,
        setup_quality_tier: 'HIGH_QUALITY',
        institutional_signal: true,
        price_action_quality: 'Clean',
        safety_label: 'BEGINNER_FRIENDLY',
        personality: {
          trend_strength: 4,
          volatility_rating: 3,
          conviction: 4,
          complexity: 'Simple trend-following setup',
        },
        explanation: {
          why_qualified: ['Strong momentum continuation'],
          what_could_go_wrong: ['Failed breakout'],
          setup_type: 'Momentum breakout',
          key_insight: 'Trend remains valid while above stop.',
        },
        invalidation_rules: [
          {
            rule_id: 'stop_break',
            condition: 'Close below stop price',
            metric: 'close',
            threshold: 170.0,
          },
        ],
        professional_insight: 'Wait for a calm pullback before scaling in.',
      },
    },
  };
}

function buildWorkspaceChatResponse(answer = 'AAPL has one pending order in the current workspace.') {
  return {
    answer,
    warnings: ['Using cached intelligence context.'],
    facts_used: ['selected_ticker', 'portfolio.orders.pending_count'],
    context_meta: {
      selected_ticker: 'AAPL',
      sources: [
        {
          source: 'portfolio',
          label: 'Portfolio',
          loaded: true,
          origin: 'stored_state',
          asof: '2026-03-13',
          count: 3,
        },
        {
          source: 'screener',
          label: 'Screener',
          loaded: true,
          origin: 'workspace_snapshot',
          asof: '2026-03-13',
          count: 1,
        },
        {
          source: 'intelligence',
          label: 'Intelligence',
          loaded: true,
          origin: 'cached_snapshot',
          asof: '2026-03-13',
          count: 2,
        },
        {
          source: 'education',
          label: 'Education',
          loaded: false,
          origin: 'cached_snapshot',
          asof: '2026-03-13',
          count: 0,
        },
      ],
    },
    conversation_state: [
      { role: 'user', content: 'What should I know about AAPL?' },
      { role: 'assistant', content: answer },
    ],
  };
}

describe('Workspace Page', () => {
  beforeEach(() => {
    localStorage.clear();
    useOnboardingStore.setState({ status: 'completed', currentStep: 0 });
    useScreenerStore.setState({ lastResult: null });
    useWorkspaceStore.setState({
      selectedTicker: null,
      analysisTab: 'overview',
      runScreenerTrigger: 0,
    });
  });

  it('renders the workspace panel structure', async () => {
    renderWithProviders(<Workspace />);

    expect(screen.getByRole('heading', { name: 'Workspace' })).toBeInTheDocument();
    expect(screen.getByText('Screener Inbox')).toBeInTheDocument();
    expect(screen.getByText('Analysis Canvas')).toBeInTheDocument();
    expect(screen.getByText('Workspace Chat')).toBeInTheDocument();
    expect(screen.getByText('Portfolio')).toBeInTheDocument();
  });

  it('loads a selected ticker into analysis after screener run', async () => {
    const { user } = renderWithProviders(<Workspace />);

    expect(screen.getByText('Select a candidate from the screener to begin analysis.')).toBeInTheDocument();

    const runButtons = screen.getAllByRole('button', { name: /Run Screener/i });
    await user.click(runButtons[0]);

    await screen.findByRole('heading', { name: 'AAPL' });
    await waitFor(() => {
      expect(screen.queryByText('Select a candidate from the screener to begin analysis.')).not.toBeInTheDocument();
    });
  });

  it('shows both screener score and confidence in the candidate row and order notes', async () => {
    const { user } = renderWithProviders(<Workspace />);

    await user.click(screen.getAllByRole('button', { name: /Run Screener/i })[0]);
    await screen.findByRole('heading', { name: 'AAPL' });

    expect(screen.getByText('Score 95.0')).toBeInTheDocument();
    expect(screen.getByText('72.5% confidence')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Order' }));
    expect(screen.getByLabelText('Notes')).toHaveValue(
      'From screener: Score 95.0, Confidence 72.5%, Rank #1'
    );
  });

  it('shows watch controls for screener and portfolio symbols', async () => {
    const { user } = renderWithProviders(<Workspace />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Watch VALE/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Watch VALE/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Unwatch VALE/i })).toBeInTheDocument();
    });

    const runButtons = screen.getAllByRole('button', { name: /Run Screener/i });
    await user.click(runButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Watch AAPL/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Watch AAPL/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Unwatch AAPL/i })).toBeInTheDocument();
    });
  });

  it('loads a portfolio ticker into analysis when clicking the portfolio table', async () => {
    const { user } = renderWithProviders(<Workspace />);

    await screen.findByText('VALE');
    await user.click(screen.getByText('VALE'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'VALE' })).toBeInTheDocument();
      expect(screen.getByText('No screener metrics are available for this ticker yet.')).toBeInTheDocument();
    });
  });

  it('opens sentiment tab when quick action is clicked', async () => {
    const { user } = renderWithProviders(<Workspace />);

    const runButtons = screen.getAllByRole('button', { name: /Run Screener/i });
    await user.click(runButtons[0]);
    await screen.findByRole('heading', { name: 'AAPL' });

    const expandButtons = await screen.findAllByRole('button', { name: /Expand details/i });
    await user.click(expandButtons[0]);

    const sentimentAction = await screen.findByRole('button', { name: /Sentiment/i });
    await user.click(sentimentAction);

    await waitFor(() => {
      expect(screen.getByText('Sentiment lookback override (hours)')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('loads ticker from workspace list into analysis canvas without opening a dialog', async () => {
    const { user } = renderWithProviders(<Workspace />);

    const runButtons = screen.getAllByRole('button', { name: /Run Screener/i });
    await user.click(runButtons[0]);
    await screen.findByRole('heading', { name: 'AAPL' });

    await user.click(screen.getByRole('button', { name: 'AAPL' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'AAPL' })).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('auto-scrolls to analysis canvas on mobile when selecting a screener ticker', async () => {
    const originalMatchMedia = window.matchMedia;
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoViewMock = vi.fn();
    window.matchMedia = ((query: string) => ({
      matches: query === '(max-width: 1279px)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoViewMock,
    });

    try {
      const { user } = renderWithProviders(<Workspace />);

      const runButtons = screen.getAllByRole('button', { name: /Run Screener/i });
      await user.click(runButtons[0]);
      await screen.findByRole('heading', { name: 'AAPL' });

      await user.click(screen.getByRole('button', { name: 'AAPL' }));

      await waitFor(() => {
        expect(scrollIntoViewMock).toHaveBeenCalled();
      });
    } finally {
      if (originalScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
          configurable: true,
          writable: true,
          value: originalScrollIntoView,
        });
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
      }
      window.matchMedia = originalMatchMedia;
    }
  });

  it('does not auto-scroll to analysis canvas on non-mobile screener selection', async () => {
    const originalMatchMedia = window.matchMedia;
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoViewMock = vi.fn();
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoViewMock,
    });

    try {
      const { user } = renderWithProviders(<Workspace />);

      const runButtons = screen.getAllByRole('button', { name: /Run Screener/i });
      await user.click(runButtons[0]);
      await screen.findByRole('heading', { name: 'AAPL' });

      await user.click(screen.getByRole('button', { name: 'AAPL' }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'AAPL' })).toBeInTheDocument();
      });
      expect(scrollIntoViewMock).not.toHaveBeenCalled();
    } finally {
      if (originalScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
          configurable: true,
          writable: true,
          value: originalScrollIntoView,
        });
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
      }
      window.matchMedia = originalMatchMedia;
    }
  });

  it('opens fill-order modal for pending entry orders in the portfolio panel', async () => {
    server.use(
      http.get('*/api/portfolio/orders', ({ request }) => {
        const url = new URL(request.url);
        const status = url.searchParams.get('status');
        if (status && status !== 'pending') {
          return HttpResponse.json({ orders: [], asof: '2026-02-19' });
        }
        return HttpResponse.json({
          orders: [
            {
              order_id: 'ORD-IBE-ENTRY',
              ticker: 'IBE.MC',
              status: 'pending',
              order_kind: 'entry',
              order_type: 'BUY_LIMIT',
              quantity: 3,
              limit_price: 20.09,
              stop_price: 19.47,
              order_date: '2026-02-19',
              filled_date: '',
              entry_price: null,
              position_id: null,
              parent_order_id: null,
              tif: 'GTC',
              notes: '',
            },
          ],
          asof: '2026-02-19',
        });
      }),
    );

    const { user } = renderWithProviders(<Workspace />);

    await screen.findByText('IBE.MC');
    const rowFillButton = screen.getByRole('button', { name: 'Fill Order' });
    await user.click(rowFillButton);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Fill Order - IBE.MC')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Filled Price')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Filled Date')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Stop Price (for linked stop)')).toBeInTheDocument();
  });

  it('shows the shared order review layout in the order tab', async () => {
    server.use(
      http.post('*/api/screener/run', () =>
        HttpResponse.json({
          candidates: [
            {
              ticker: 'AAPL',
              currency: 'USD',
              rank: 1,
              score: 0.95,
              close: 175.5,
              last_bar: '2026-02-18T16:00:00',
              sma_20: 170,
              sma_50: 165,
              sma_200: 160,
              atr: 3.25,
              momentum_6m: 25,
              momentum_12m: 45,
              rel_strength: 85.2,
              confidence: 72.5,
              recommendation: {
                verdict: 'RECOMMENDED',
                reasons_short: ['Trend aligned'],
                reasons_detailed: [],
                risk: {
                  entry: 175.5,
                  stop: 170.0,
                  target: 186.0,
                  rr: 2.0,
                  risk_amount: 20,
                  risk_pct: 0.01,
                  position_size: 500,
                  shares: 2,
                  invalidation_level: 170.0,
                },
                costs: {
                  commission_estimate: 1,
                  fx_estimate: 0,
                  slippage_estimate: 0.5,
                  total_cost: 1.5,
                  fee_to_risk_pct: 0.075,
                },
                checklist: [],
                education: {
                  common_bias_warning: 'Avoid overtrading',
                  what_to_learn: 'Breakout confirmation',
                  what_would_make_valid: ['Close above resistance'],
                },
                thesis: {
                  ticker: 'AAPL',
                  strategy: 'Momentum',
                  entry_type: 'Breakout',
                  trend_status: 'Uptrend',
                  relative_strength: 'Strong',
                  regime_alignment: true,
                  volatility_state: 'Normal',
                  risk_reward: 2.2,
                  setup_quality_score: 88,
                  setup_quality_tier: 'HIGH_QUALITY',
                  institutional_signal: true,
                  price_action_quality: 'Clean',
                  safety_label: 'BEGINNER_FRIENDLY',
                  personality: {
                    trend_strength: 4,
                    volatility_rating: 3,
                    conviction: 4,
                    complexity: 'Simple trend-following setup',
                  },
                  explanation: {
                    why_qualified: ['Strong momentum continuation'],
                    what_could_go_wrong: ['Failed breakout'],
                    setup_type: 'Momentum breakout',
                    key_insight: 'Trend remains valid while above stop.',
                  },
                  invalidation_rules: [
                    {
                      rule_id: 'stop_break',
                      condition: 'Close below stop price',
                      metric: 'close',
                      threshold: 170.0,
                    },
                  ],
                  professional_insight: 'Wait for a calm pullback before scaling in.',
                },
              },
            },
          ],
          asof_date: '2026-02-18',
          total_screened: 1,
          data_freshness: 'final_close',
          warnings: [],
        })
      ),
    );

    const { user } = renderWithProviders(<Workspace />);
    const runButtons = screen.getAllByRole('button', { name: /Run Screener/i });
    await user.click(runButtons[0]);
    await screen.findByRole('heading', { name: 'AAPL' });

    await user.click(screen.getByRole('tab', { name: 'Order' }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Decision' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: 'Setup Case' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Risk / Invalidation' })).toBeInTheDocument();
      expect(screen.getByText('Place Order')).toBeInTheDocument();
    });
    expect(screen.queryByText('Trade Thesis')).not.toBeInTheDocument();
  });

  it('shows breakout setup execution guidance in the action panel', async () => {
    server.use(
      http.post('*/api/screener/run', () =>
        HttpResponse.json({
          candidates: [
            {
              ticker: 'AAPL',
              currency: 'USD',
              rank: 1,
              score: 0.95,
              close: 175.5,
              last_bar: '2026-02-18T16:00:00',
              sma_20: 170,
              sma_50: 165,
              sma_200: 160,
              atr: 3.25,
              momentum_6m: 25,
              momentum_12m: 45,
              rel_strength: 85.2,
              confidence: 72.5,
              signal: 'breakout',
              recommendation: {
                verdict: 'RECOMMENDED',
                reasons_short: ['Trend aligned'],
                reasons_detailed: [],
                risk: {
                  entry: 175.5,
                  stop: 170.0,
                  target: 186.0,
                  rr: 2.0,
                  risk_amount: 20,
                  risk_pct: 0.01,
                  position_size: 500,
                  shares: 2,
                },
                costs: {
                  commission_estimate: 1,
                  fx_estimate: 0,
                  slippage_estimate: 0.5,
                  total_cost: 1.5,
                  fee_to_risk_pct: 0.075,
                },
                checklist: [],
                education: {
                  common_bias_warning: 'Avoid overtrading',
                  what_to_learn: 'Breakout confirmation',
                  what_would_make_valid: ['Close above resistance'],
                },
              },
            },
          ],
          asof_date: '2026-02-18',
          total_screened: 1,
          data_freshness: 'final_close',
          warnings: [],
        })
      ),
    );

    const { user } = renderWithProviders(<Workspace />);
    const runButtons = screen.getAllByRole('button', { name: /Run Screener/i });
    await user.click(runButtons[0]);
    await screen.findByRole('heading', { name: 'AAPL' });

    await user.click(screen.getByRole('tab', { name: 'Order' }));

    await waitFor(() => {
      expect(screen.getByText('Setup Execution (Degiro)')).toBeInTheDocument();
      expect(screen.getAllByText('Breakout setup').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/BUY STOP/i).length).toBeGreaterThan(0);
    });
  });

  it('shows pullback setup execution guidance in the action panel', async () => {
    server.use(
      http.post('*/api/screener/run', () =>
        HttpResponse.json({
          candidates: [
            {
              ticker: 'AAPL',
              currency: 'USD',
              rank: 1,
              score: 0.95,
              close: 175.5,
              last_bar: '2026-02-18T16:00:00',
              sma_20: 170,
              sma_50: 165,
              sma_200: 160,
              atr: 3.25,
              momentum_6m: 25,
              momentum_12m: 45,
              rel_strength: 85.2,
              confidence: 72.5,
              signal: 'pullback',
              recommendation: {
                verdict: 'RECOMMENDED',
                reasons_short: ['Trend aligned'],
                reasons_detailed: [],
                risk: {
                  entry: 175.5,
                  stop: 170.0,
                  target: 186.0,
                  rr: 2.0,
                  risk_amount: 20,
                  risk_pct: 0.01,
                  position_size: 500,
                  shares: 2,
                },
                costs: {
                  commission_estimate: 1,
                  fx_estimate: 0,
                  slippage_estimate: 0.5,
                  total_cost: 1.5,
                  fee_to_risk_pct: 0.075,
                },
                checklist: [],
                education: {
                  common_bias_warning: 'Avoid overtrading',
                  what_to_learn: 'Pullback confirmation',
                  what_would_make_valid: ['Reclaim support'],
                },
              },
            },
          ],
          asof_date: '2026-02-18',
          total_screened: 1,
          data_freshness: 'final_close',
          warnings: [],
        })
      ),
    );

    const { user } = renderWithProviders(<Workspace />);
    const runButtons = screen.getAllByRole('button', { name: /Run Screener/i });
    await user.click(runButtons[0]);
    await screen.findByRole('heading', { name: 'AAPL' });

    await user.click(screen.getByRole('tab', { name: 'Order' }));

    await waitFor(() => {
      expect(screen.getByText('Setup Execution (Degiro)')).toBeInTheDocument();
      expect(screen.getAllByText('Pullback setup').length).toBeGreaterThan(0);
    });
  });

  it('runs per-symbol intelligence from expanded row details and patches generated educational thesis', async () => {
    let runCallCount = 0;
    server.use(
      http.post('*/api/screener/run', () =>
        HttpResponse.json({
          candidates: [buildCandidateWithThesis('AAPL')],
          asof_date: '2026-02-18',
          total_screened: 1,
          data_freshness: 'final_close',
          warnings: [],
        })
      ),
      http.post('*/api/intelligence/run', async ({ request }) => {
        runCallCount += 1;
        const body = await request.json();
        const symbols = Array.isArray((body as Record<string, unknown>)?.symbols)
          ? ((body as Record<string, unknown>).symbols as string[])
          : [];
        return HttpResponse.json({
          job_id: 'intel-row-1',
          status: 'queued',
          total_symbols: symbols.length || 1,
          created_at: '2026-02-18T20:00:00',
          updated_at: '2026-02-18T20:00:00',
        });
      }),
      http.get('*/api/intelligence/run/:jobId', ({ params }) =>
        HttpResponse.json({
          job_id: params.jobId as string,
          status: 'completed',
          total_symbols: 1,
          completed_symbols: 1,
          asof_date: '2026-02-18',
          opportunities_count: 1,
          llm_warnings_count: 0,
          llm_warning_sample: null,
          created_at: '2026-02-18T20:00:00',
          updated_at: '2026-02-18T20:00:04',
        })
      ),
      http.get('*/api/intelligence/opportunities', () =>
        HttpResponse.json({
          asof_date: '2026-02-18',
          opportunities: [
            {
              symbol: 'AAPL',
              technical_readiness: 0.8,
              catalyst_strength: 0.7,
              opportunity_score: 0.76,
              state: 'TRENDING',
              explanations: ['Catalyst + follow-through confirmed.'],
            },
          ],
        })
      ),
      http.post('*/api/intelligence/education/generate', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          symbol: body.symbol ?? 'AAPL',
          asof_date: body.asof_date ?? '2026-02-18',
          generated_at: '2026-02-18T20:00:05',
          status: 'ok',
          source: 'llm',
          template_version: 'v1',
          deterministic_facts: {
            state: 'TRENDING',
            rr: '2.00',
          },
          outputs: {
            thesis: {
              title: 'Why this trade idea exists (AAPL)',
              summary: 'AAPL is validated by trend quality, catalyst strength, and clear stop-based risk.',
              bullets: ['Trend structure is intact.'],
              watchouts: ['Exit if stop is violated.'],
              next_steps: ['Verify risk before execution.'],
              glossary_links: ['trade_thesis', 'rr'],
              facts_used: ['state', 'rr'],
              source: 'llm',
              template_version: 'v1',
              generated_at: '2026-02-18T20:00:05',
              debug_ref: 'AAPL:thesis:test',
            },
          },
          errors: [],
        });
      })
    );

    const { user } = renderWithProviders(<Workspace />);
    await user.click(screen.getAllByRole('button', { name: /Run Screener/i })[0]);
    await screen.findByRole('heading', { name: 'AAPL' });

    await user.click(screen.getByRole('button', { name: /Expand details for AAPL/i }));
    await user.click(screen.getByRole('button', { name: /Run intelligence for AAPL/i }));

    expect(
      await screen.findAllByText('Intelligence complete. Explanation source: LLM.')
    ).not.toHaveLength(0);
    expect(runCallCount).toBe(1);

    await user.click(screen.getByRole('tab', { name: 'Order' }));
    await user.click(screen.getByRole('tab', { name: 'Setup Case' }));
    expect(
      await screen.findByText('AAPL is validated by trend quality, catalyst strength, and clear stop-based risk.')
    ).toBeInTheDocument();
  });

  it('runs per-symbol intelligence from analysis canvas action', async () => {
    let runBodySymbols: string[] = [];
    server.use(
      http.post('*/api/screener/run', () =>
        HttpResponse.json({
          candidates: [buildCandidateWithThesis('AAPL')],
          asof_date: '2026-02-18',
          total_screened: 1,
          data_freshness: 'final_close',
          warnings: [],
        })
      ),
      http.post('*/api/intelligence/run', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        runBodySymbols = Array.isArray(body.symbols)
          ? (body.symbols as unknown[]).map((value) => String(value).toUpperCase())
          : [];
        return HttpResponse.json({
          job_id: 'intel-canvas-1',
          status: 'queued',
          total_symbols: runBodySymbols.length || 1,
          created_at: '2026-02-18T20:00:00',
          updated_at: '2026-02-18T20:00:00',
        });
      }),
      http.get('*/api/intelligence/run/:jobId', ({ params }) =>
        HttpResponse.json({
          job_id: params.jobId as string,
          status: 'completed',
          total_symbols: 1,
          completed_symbols: 1,
          asof_date: '2026-02-18',
          opportunities_count: 1,
          llm_warnings_count: 0,
          llm_warning_sample: null,
          created_at: '2026-02-18T20:00:00',
          updated_at: '2026-02-18T20:00:04',
        })
      )
    );

    const { user } = renderWithProviders(<Workspace />);
    await user.click(screen.getAllByRole('button', { name: /Run Screener/i })[0]);
    await screen.findByRole('heading', { name: 'AAPL' });

    const canvasRunButton = screen
      .getAllByRole('button', { name: 'Run Intelligence' })
      .find((button) => button.getAttribute('aria-label') !== 'Run intelligence for AAPL');
    expect(canvasRunButton).toBeDefined();
    await user.click(canvasRunButton!);

    expect(
      await screen.findAllByText('Intelligence complete. Explanation source: LLM.')
    ).not.toHaveLength(0);
    expect(runBodySymbols).toEqual(['AAPL']);
  });

  it('sends the selected ticker and current screener snapshot to workspace chat', async () => {
    let capturedBody: any = null;

    server.use(
      http.post('*/api/screener/run', () =>
        HttpResponse.json({
          candidates: [buildCandidateWithThesis('AAPL')],
          asof_date: '2026-03-13',
          total_screened: 1,
          data_freshness: 'final_close',
          warnings: [],
        })
      ),
      http.post('*/api/chat/answer', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(buildWorkspaceChatResponse('AAPL remains a valid focus ticker.'));
      })
    );

    const { user } = renderWithProviders(<Workspace />);
    await user.click(screen.getAllByRole('button', { name: /Run Screener/i })[0]);
    await screen.findByRole('heading', { name: 'AAPL' });

    await user.type(screen.getByLabelText('Ask the workspace agent'), 'What should I know about AAPL?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));

    await screen.findByText('AAPL remains a valid focus ticker.');

    expect(capturedBody).toMatchObject({
      question: 'What should I know about AAPL?',
      selected_ticker: 'AAPL',
    });
    expect(capturedBody.workspace_snapshot.asof_date).toBe('2026-03-13');
    expect(capturedBody.workspace_snapshot.total_screened).toBe(1);
    expect(capturedBody.workspace_snapshot.candidates[0]).toMatchObject({
      ticker: 'AAPL',
      recommendation_verdict: 'RECOMMENDED',
    });
  });

  it('renders workspace chat answers, warnings, and context badges', async () => {
    server.use(http.post('*/api/chat/answer', () => HttpResponse.json(buildWorkspaceChatResponse())));

    const { user } = renderWithProviders(<Workspace />);

    await user.type(screen.getByLabelText('Ask the workspace agent'), 'What should I know about AAPL?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));

    await screen.findByText('AAPL has one pending order in the current workspace.');

    expect(screen.getByText('Using cached intelligence context.')).toBeInTheDocument();
    expect(screen.getByText('Portfolio ready')).toBeInTheDocument();
    expect(screen.getByText('Screener ready')).toBeInTheDocument();
    expect(screen.getByText('Intelligence ready')).toBeInTheDocument();
    expect(screen.getByText('Education missing')).toBeInTheDocument();
    expect(screen.getByText(/Facts used: selected_ticker, portfolio.orders.pending_count/i)).toBeInTheDocument();
  });

  it('renders workspace chat backend errors cleanly', async () => {
    server.use(
      http.post('*/api/chat/answer', () =>
        HttpResponse.json({ detail: 'Workspace chat timed out.' }, { status: 500 })
      )
    );

    const { user } = renderWithProviders(<Workspace />);

    await user.type(screen.getByLabelText('Ask the workspace agent'), 'What is my risk?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Workspace chat timed out.');
  });
});
