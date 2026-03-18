import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import OnboardingStrategySetupStep from './OnboardingStrategySetupStep';

const mockUseActiveStrategyQuery = vi.fn();
const mockMutate = vi.fn();

vi.mock('@/features/strategy/hooks', () => ({
  useActiveStrategyQuery: () => mockUseActiveStrategyQuery(),
  useUpdateStrategyMutation: (onSuccess?: (updated: any) => void) => ({
    mutate: (payload: any) => {
      mockMutate(payload);
      onSuccess?.(payload);
    },
    isPending: false,
    isError: false,
    error: null,
  }),
}));

function buildStrategy(): any {
  return {
    id: 'default',
    name: 'Default',
    description: '',
    module: 'momentum',
    universe: {
      trend: { smaFast: 20, smaMid: 50, smaLong: 200 },
      vol: { atrWindow: 14 },
      mom: { lookback6m: 126, lookback12m: 252, benchmark: 'SPY' },
      filt: {
        minPrice: 5,
        maxPrice: 500,
        maxAtrPct: 15,
        requireTrendOk: true,
        requireRsPositive: true,
        currencies: ['USD', 'EUR'],
      },
    },
    ranking: { wMom6m: 0.4, wMom12m: 0.4, wRs6m: 0.2, topN: 10 },
    signals: { breakoutLookback: 50, pullbackMa: 20, minHistory: 252 },
    risk: {
      accountSize: 10000,
      riskPct: 0.01,
      maxPositionPct: 0.2,
      minShares: 1,
      kAtr: 2,
      minRr: 2,
      rrTarget: 3,
      commissionPct: 0,
      maxFeeRiskPct: 0.2,
      regimeEnabled: false,
      regimeTrendSma: 200,
      regimeTrendMultiplier: 0.8,
      regimeVolAtrWindow: 14,
      regimeVolAtrPctThreshold: 4,
      regimeVolMultiplier: 0.75,
    },
    manage: {
      breakevenAtR: 1,
      trailAfterR: 2,
      trailSma: 20,
      smaBufferPct: 1,
      maxHoldingDays: 20,
      benchmark: 'SPY',
    },
    marketIntelligence: {
      enabled: false,
      providers: [],
      universeScope: 'screener_universe',
      marketContextSymbols: [],
      llm: {
        enabled: false,
        provider: 'mock',
        model: 'mock',
        baseUrl: '',
        enableCache: false,
        enableAudit: false,
        cachePath: '',
        auditPath: '',
        maxConcurrency: 1,
      },
      catalyst: {
        lookbackHours: 24,
        recencyHalfLifeHours: 24,
        falseCatalystReturnZ: 1,
        minPriceReactionAtr: 1,
        requirePriceConfirmation: false,
      },
      theme: {
        enabled: false,
        minClusterSize: 2,
        minPeerConfirmation: 1,
        curatedPeerMapPath: '',
      },
      opportunity: {
        technicalWeight: 0.5,
        catalystWeight: 0.5,
        maxDailyOpportunities: 5,
        minOpportunityScore: 0.1,
      },
    },
    isDefault: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

describe('OnboardingStrategySetupStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseActiveStrategyQuery.mockReturnValue({
      data: buildStrategy(),
      isLoading: false,
      isError: false,
    });
  });

  it('renders setup mode actions', () => {
    renderWithProviders(<OnboardingStrategySetupStep />);

    expect(screen.getByRole('button', { name: 'Conservative' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Balanced' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aggressive' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Custom' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save strategy' })).toBeInTheDocument();
  });

  it('allows custom field edits and saves updated strategy', () => {
    renderWithProviders(<OnboardingStrategySetupStep />);

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText('Account Size'), { target: { value: '25000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save strategy' }));

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const payload = mockMutate.mock.calls[0][0];
    expect(payload.risk.accountSize).toBe(25000);
  });

  it('applies conservative preset values before save', () => {
    renderWithProviders(<OnboardingStrategySetupStep />);

    fireEvent.click(screen.getByRole('button', { name: 'Conservative' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save strategy' }));

    const payload = mockMutate.mock.calls[0][0];
    expect(payload.risk.riskPct).toBe(0.01);
    expect(payload.risk.minRr).toBe(2.5);
  });
});
