import { beforeEach, describe, expect, it } from 'vitest';
import { HttpResponse, http } from 'msw';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import Workspace from './Workspace';
import { server } from '@/test/mocks/server';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useScreenerStore } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

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
    });
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

  it('shows the structured thesis panel in the order tab', async () => {
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
      expect(screen.getByText('Trade Thesis')).toBeInTheDocument();
      expect(screen.getByText('Setup Quality Score')).toBeInTheDocument();
    });
    expect(screen.queryByPlaceholderText('Write your thesis for AAPL...')).not.toBeInTheDocument();
  });
});
