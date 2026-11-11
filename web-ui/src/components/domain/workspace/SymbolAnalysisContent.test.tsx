import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { API_BASE_URL } from '@/lib/api';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import SymbolAnalysisContent from './SymbolAnalysisContent';
import type { WorkspaceAnalysisTab } from './types';
import { mockScreenerResults } from '@/test/mocks/handlers';
import ActionPanel from './ActionPanel';
import { formatCurrency } from '@/utils/formatters';
import { transformScreenerResponse } from '@/features/screener/types';

const position = {
  positionId: 'POS-1', ticker: 'LRCX', entryPrice: 383.04, stopPrice: 346.3, targetPrice: 498.26,
  shares: 2, perShareRisk: 36.74, rNow: 0.51, daysOpen: 10, pnl: 0, pnlPercent: 0,
  entryValue: 766.08, currentValue: 803.64, totalRisk: 73.48, feesEur: 0, rFxAdjusted: null,
  timeStopWarning: false, trailMethod: 'sma20', trailParam: null,
} as any;

describe('SymbolAnalysisContent held mode', () => {
  it('hides the Order tab and folds the manage panel into Overview', () => {
    renderWithProviders(
      <SymbolAnalysisContent ticker="LRCX" candidate={null} position={position} activeTab="overview" onTabChange={() => {}} orderPanel={<div>order</div>} />,
    );
    expect(screen.queryByRole('tab', { name: t('workspacePage.panels.analysis.tabs.order') })).not.toBeInTheDocument();
    expect(screen.getByText(t('workspacePage.panels.analysis.managePosition.title'))).toBeInTheDocument();
  });

  it('shows the Order tab for a held symbol only with a canonical ready add-on', () => {
    const candidate = {
      sameSymbol: { mode: 'ADD_ON' },
      recommendation: { workflowStatus: 'ready', nextStep: { code: 'review_order' } },
      executionEligibility: { allowed: true, mode: 'ready', reason: null },
      canonicalOrderDraft: { orderType: 'BUY_STOP', entry: 383.04, stop: 346.3, target: 498.26, shares: 1, rr: 3.1, quoteCurrency: 'USD', approvalToken: 'signed' },
    } as any;
    renderWithProviders(
      <SymbolAnalysisContent ticker="LRCX" candidate={candidate} position={position} activeTab="overview" onTabChange={() => {}} orderPanel={<div>order</div>} />,
    );
    expect(screen.getByRole('tab', { name: t('workspacePage.panels.analysis.tabs.order') })).toBeInTheDocument();
  });

  it('shows the Order tab for a canonical ready scale-back entry', () => {
    const candidate = {
      sameSymbol: { mode: 'SCALE_BACK' },
      recommendation: { workflowStatus: 'ready', nextStep: { code: 'review_order' } },
      executionEligibility: { allowed: true, mode: 'ready', reason: null },
      canonicalOrderDraft: { orderType: 'BUY_STOP', entry: 383.04, stop: 346.3, target: 498.26, shares: 1, rr: 3.1, quoteCurrency: 'USD', approvalToken: 'signed' },
    } as any;
    renderWithProviders(
      <SymbolAnalysisContent ticker="LRCX" candidate={candidate} position={position} activeTab="overview" onTabChange={() => {}} orderPanel={<div>order</div>} />,
    );
    expect(screen.getByRole('tab', { name: t('workspacePage.panels.analysis.tabs.order') })).toBeInTheDocument();
  });

  it('hides the Order tab for a held candidate that is not canonically ready', () => {
    const candidate = {
      sameSymbol: { mode: 'ADD_ON' },
      recommendation: { workflowStatus: 'waiting_trigger', nextStep: { code: 'wait_pullback' } },
    } as any;
    renderWithProviders(
      <SymbolAnalysisContent ticker="LRCX" candidate={candidate} position={position} activeTab="overview" onTabChange={() => {}} orderPanel={<div>order</div>} />,
    );
    expect(screen.queryByRole('tab', { name: t('workspacePage.panels.analysis.tabs.order') })).not.toBeInTheDocument();
  });
});

function buyNowCandidate(workflowStatus: 'ready' | 'no_setup') {
  return {
    ticker: 'AAPL', currency: 'USD', entry: 200, stop: 190,
    recommendation: {
      workflowStatus,
      nextStep: workflowStatus === 'ready' ? { code: 'review_order' } : { code: 'observe' },
    },
    ...(workflowStatus === 'ready' ? {
      executionEligibility: { allowed: true, mode: 'ready', reason: null },
      canonicalOrderDraft: { orderType: 'BUY_STOP', entry: 200, stop: 190, target: 220, shares: 1, rr: 2, quoteCurrency: 'USD', approvalToken: 'signed' },
    } : {}),
    decisionSummary: {
      symbol: 'AAPL', action: 'BUY_NOW', conviction: 'high', technicalLabel: 'strong',
      fundamentalsLabel: 'strong', valuationLabel: 'fair', catalystLabel: 'active',
      whyNow: '', whatToDo: '', mainRisk: '',
      tradePlan: { entry: 200, stop: 190, target: 220, rr: 2 },
      drivers: { positives: [], negatives: [], warnings: [] },
      valuationContext: { method: 'not_available', summary: '' },
    },
  } as any;
}

function CandidateOrderHarness({ workflowStatus }: { workflowStatus: 'ready' | 'no_setup' }) {
  const [activeTab, setActiveTab] = useState<WorkspaceAnalysisTab>('overview');
  return (
    <SymbolAnalysisContent
      ticker="AAPL"
      candidate={buyNowCandidate(workflowStatus)}
      position={null}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      orderPanel={<div>order panel</div>}
    />
  );
}

describe('SymbolAnalysisContent candidate order transition', () => {
  it('runs fundamentals when no initial snapshot is available', async () => {
    let refreshes = 0;
    server.use(http.get(`${API_BASE_URL}/api/fundamentals/snapshot/AAPL`, ({ request }) => {
      if (new URL(request.url).searchParams.get('refresh') !== 'true') {
        return HttpResponse.json({ detail: 'No cached snapshot' }, { status: 404 });
      }
      refreshes += 1;
      return HttpResponse.json({
        symbol: 'AAPL', asof_date: '2026-11-10', provider: 'sec_edgar', updated_at: '2026-11-10T20:00:00Z',
        instrument_type: 'equity', supported: true, coverage_status: 'supported', freshness_status: 'current',
        company_name: 'Apple Inc.', trailing_pe: 21,
      });
    }));
    const { user } = renderWithProviders(<SymbolAnalysisContent ticker="AAPL" activeTab="fundamentals" onTabChange={() => {}} />);
    const run = await screen.findByRole('button', { name: t('workspacePage.fundamentals.run') });
    await waitFor(() => expect(run).toBeEnabled());
    await user.click(run);
    expect(await screen.findByText('Apple Inc.')).toBeVisible();
    expect(refreshes).toBe(1);
    expect(screen.getByRole('button', { name: t('workspacePage.fundamentals.refresh') })).toBeEnabled();
  });

  it('does not render a cached fundamentals snapshot for another symbol', async () => {
    server.use(http.get(`${API_BASE_URL}/api/fundamentals/snapshot/AAPL`, () => HttpResponse.json({
      symbol: 'MSFT', asof_date: '2026-11-10', provider: 'sec_edgar', updated_at: '2026-11-10T20:00:00Z',
      instrument_type: 'equity', supported: true, coverage_status: 'supported', freshness_status: 'current',
      company_name: 'Wrong company', trailing_pe: 99,
    })));
    renderWithProviders(<SymbolAnalysisContent ticker="AAPL" activeTab="fundamentals" onTabChange={() => {}} />);
    expect(await screen.findByText(t('workspacePage.fundamentals.noSnapshot'))).toBeVisible();
    expect(screen.queryByText('Wrong company')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('workspacePage.fundamentals.run') })).toBeEnabled();
  });
  it('passes the refreshed signed draft to order review', async () => {
    const recommendation = {
      verdict: 'RECOMMENDED', reasons_short: [], reasons_detailed: [],
      risk: { entry: 210, stop: 200, target: 230, shares: 1, risk_amount: 10, risk_pct: 0.01, position_size: 210 },
      costs: { commission_estimate: 0, fx_estimate: 0, slippage_estimate: 0, total_cost: 0 },
      checklist: [], education: { common_bias_warning: '', what_to_learn: '', what_would_make_valid: [] },
      workflow_status: 'ready', next_step: { code: 'review_order' },
    };
    const refreshedResponse = {
      ...mockScreenerResults,
      candidates: [{ ...mockScreenerResults.candidates[0], entry: 210, stop: 200, target: 230, recommendation,
        execution_eligibility: { allowed: true, mode: 'ready', reason: null },
        canonical_order_draft: { order_type: 'BUY_STOP', entry: 210, stop: 200, target: 230, shares: 1, rr: 2, quote_currency: 'USD', approval_token: 'fresh-signed-token' } }],
    } as const;
    server.use(http.post(`${API_BASE_URL}/api/screener/run`, () => HttpResponse.json(refreshedResponse)));
    const candidate = transformScreenerResponse({ ...refreshedResponse, candidates: [{ ...refreshedResponse.candidates[0], canonical_order_draft: { ...refreshedResponse.candidates[0].canonical_order_draft, entry: 200, stop: 190, target: 220 } }] } as any).candidates[0];
    function RefreshHarness() {
      const [activeTab, setActiveTab] = useState<WorkspaceAnalysisTab>('overview');
      return <SymbolAnalysisContent ticker="AAPL" candidate={candidate} activeTab={activeTab} onTabChange={setActiveTab} orderPanel={(reviewCandidate) => <ActionPanel ticker="AAPL" candidate={reviewCandidate} />} />;
    }
    const { user } = renderWithProviders(<RefreshHarness />);
    await user.click(screen.getByRole('button', { name: t('recommendation.workflow.nextStep.refresh_data') }));
    expect(await screen.findByText(formatCurrency(210, 'USD'))).toBeVisible();
    await user.click(screen.getByRole('button', { name: t('analysis.prepareOrder') }));
    expect(await screen.findByRole('spinbutton', { name: t('order.candidateModal.triggerPrice') })).toHaveValue(210);
  });
  it('keeps the canonical decision inside Overview instead of repeating it above every tab', async () => {
    renderWithProviders(<CandidateOrderHarness workflowStatus="ready" />);
    expect(screen.getByText(t('workspacePage.panels.analysis.decisionSummary.actions.buyNow'))).toBeVisible();

    await userEvent.click(screen.getByRole('tab', { name: t('workspacePage.panels.analysis.tabs.backtest') }));

    expect(screen.queryByText(t('workspacePage.panels.analysis.decisionSummary.actions.buyNow'))).not.toBeInTheDocument();
  });

  it('does not open the order panel from a BUY_NOW opinion without ready workflow status', () => {
    renderWithProviders(<CandidateOrderHarness workflowStatus="no_setup" />);

    expect(screen.queryByRole('button', { name: /prepare order/i })).not.toBeInTheDocument();
    expect(screen.queryByText('order panel')).not.toBeInTheDocument();
  });

  it('opens the order panel from a canonical ready candidate', async () => {
    renderWithProviders(<CandidateOrderHarness workflowStatus="ready" />);

    await userEvent.click(screen.getByRole('button', { name: /prepare order/i }));
    expect(screen.getByText('order panel')).toBeInTheDocument();
  });

  it('does not expose an Order tab without a canonical candidate', () => {
    renderWithProviders(<SymbolAnalysisHarness />);

    expect(screen.queryByRole('tab', { name: t('workspacePage.panels.analysis.tabs.order') })).not.toBeInTheDocument();
  });
});

function SymbolAnalysisHarness() {
  const [activeTab, setActiveTab] = useState<WorkspaceAnalysisTab>('overview');
  return (
    <SymbolAnalysisContent
      ticker="AAPL"
      candidate={null}
      position={null}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      orderPanel={<div>order</div>}
    />
  );
}

describe('SymbolAnalysisContent volume zones tab', () => {
  it('registers and renders the Volume Zones tab', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/market-data/AAPL/volume-analysis`, () =>
        HttpResponse.json({
          symbol: 'AAPL',
          provider: 'mock',
          interval: '1d',
          lookback: 120,
          min_rr: 2,
          data_quality: { ok: true, bars: 160, warnings: [] },
          profile_type: 'approximate_bar_based',
          market_bias: 'bullish',
          setup_type: 'hvn_support_retest',
          action: 'Long',
          confidence_score: 72.5,
          rationale: ['Market bias is bullish.'],
          key_levels: {
            price: 100,
            poc: 95,
            vwap: 96,
            sma20: 94,
            sma50: 90,
            sma200: 80,
            atr14: 2.5,
            swing_high: 105,
            swing_low: 88,
            rel_volume: 1.3,
          },
          volume_zones: [
            {
              kind: 'poc',
              role: 'buyer_defense',
              price_low: 94,
              price_high: 96,
              center: 95,
              volume_share: 0.18,
            },
          ],
          trade_plan: { direction: 'long', entry: 100, stop: 93, target: 114, rr: 2.0 },
          warnings: ['Approximate volume profile built from OHLCV bars, not tick-level trades.'],
        }),
      ),
      http.get(`${API_BASE_URL}/api/market-data/AAPL/candles`, () =>
        HttpResponse.json({ ticker: 'AAPL', price_history: [], patterns: [] }),
      ),
    );

    renderWithProviders(<SymbolAnalysisHarness />);
    await userEvent.click(screen.getByRole('tab', { name: t('workspacePage.panels.analysis.tabs.volumeZones') }));
    expect(await screen.findByText(t('workspacePage.panels.analysis.volumeZones.actions.long'))).toBeInTheDocument();
    expect(screen.getByText(/Approximate volume profile/)).toBeInTheDocument();
  });
});
