import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { API_BASE_URL } from '@/lib/api';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import SymbolAnalysisContent from './SymbolAnalysisContent';
import type { WorkspaceAnalysisTab } from './types';

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
    expect(await screen.findByText('Long')).toBeInTheDocument();
    expect(screen.getByText(/Approximate volume profile/)).toBeInTheDocument();
  });
});
