import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import type { Strategy } from '@/features/strategy/types';
import EnhancedRiskCard from './EnhancedRiskCard';

function makeStrategy(riskOverrides: Partial<Strategy['risk']> = {}): Strategy {
  return {
    id: 'test',
    name: 'Test',
    module: 'momentum',
    universe: {
      trend: { smaFast: 50, smaMid: 100, smaLong: 200 },
      vol: { atrWindow: 14 },
      mom: { lookback6m: 125, lookback12m: 252, benchmark: 'SPY' },
      filt: {
        minPrice: 5,
        maxPrice: 1000,
        maxAtrPct: 0.1,
        requireTrendOk: true,
        requireRsPositive: true,
        currencies: ['USD'],
      },
    },
    ranking: { wMom6m: 0.5, wMom12m: 0.3, wRs6m: 0.2, topN: 10 },
    signals: { breakoutLookback: 20, pullbackMa: 10, minHistory: 50 },
    risk: {
      accountSize: 50000,
      riskPct: 0.02,
      maxPositionPct: 0.2,
      minShares: 1,
      kAtr: 1.5,
      minRr: 2.0,
      rrTarget: 2.0,
      commissionPct: 0,
      maxFeeRiskPct: 0.2,
      accountSizeMode: 'equity',
      regimeEnabled: false,
      regimeTrendSma: 200,
      regimeTrendMultiplier: 0.5,
      regimeVolAtrWindow: 14,
      regimeVolAtrPctThreshold: 6.0,
      regimeVolMultiplier: 0.5,
      ...riskOverrides,
    },
    manage: {
      breakevenAtR: 1.0,
      trailAfterR: 2.0,
      trailSma: 20,
      smaBufferPct: 0.005,
      maxHoldingDays: 20,
      timeStopDays: 15,
      timeStopMinR: 0.5,
      benchmark: 'SPY',
    },
    marketIntelligence: {
      enabled: false,
      providers: [],
      universeScope: 'screener_universe',
      marketContextSymbols: [],
      llm: {
        enabled: false,
        provider: 'openai',
        model: '',
        baseUrl: '',
        enableCache: false,
        enableAudit: false,
        cachePath: '',
        auditPath: '',
        maxConcurrency: 1,
      },
      catalyst: {
        lookbackHours: 72,
        recencyHalfLifeHours: 36,
        falseCatalystReturnZ: 1.5,
        minPriceReactionAtr: 0.8,
        requirePriceConfirmation: true,
      },
      theme: {
        enabled: false,
        minClusterSize: 3,
        minPeerConfirmation: 2,
        curatedPeerMapPath: '',
      },
      opportunity: {
        technicalWeight: 0.55,
        catalystWeight: 0.45,
        maxDailyOpportunities: 8,
        minOpportunityScore: 0.55,
      },
    },
    isDefault: false,
    createdAt: '',
    updatedAt: '',
  };
}

describe('EnhancedRiskCard account size mode', () => {
  it('shows the account size mode selector', () => {
    renderWithProviders(<EnhancedRiskCard draft={makeStrategy()} setDraft={vi.fn()} warnings={[]} />);

    expect(screen.getByText(t('strategyPage.core.fields.accountSizeMode'))).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('equity');
  });

  it('updates the strategy draft when the mode changes', async () => {
    const user = userEvent.setup();
    const setDraft = vi.fn();
    renderWithProviders(
      <EnhancedRiskCard
        draft={makeStrategy({ accountSizeMode: 'equity' })}
        setDraft={setDraft}
        warnings={[]}
      />,
    );

    await user.selectOptions(screen.getByRole('combobox'), 'base');

    expect(setDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        risk: expect.objectContaining({ accountSizeMode: 'base' }),
      }),
    );
  });
});
