import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { 
  useStrategyReadiness, 
  isStrategyConfigured, 
  getStrategyReadiness 
} from './useStrategyReadiness';
import type { Strategy } from './types';

// Mock the strategy hooks
vi.mock('@/features/strategy/hooks', () => ({
  useActiveStrategyQuery: vi.fn(),
}));

import { useActiveStrategyQuery } from '@/features/strategy/hooks';

const mockUseActiveStrategyQuery = useActiveStrategyQuery as ReturnType<typeof vi.fn>;

// Helper to create a minimal valid strategy
const createMockStrategy = (overrides?: Partial<Strategy>): Strategy => ({
  id: 'test-strategy',
  name: 'Test Strategy',
  description: 'Test strategy description',
  module: 'momentum',
  universe: {
    trend: { smaFast: 20, smaMid: 50, smaLong: 200 },
    vol: { atrWindow: 14 },
    mom: { lookback6m: 126, lookback12m: 252, benchmark: 'SPY' },
    filt: {
      minPrice: 5,
      maxPrice: 500,
      maxAtrPct: 10,
      requireTrendOk: true,
      requireRsPositive: true,
      currencies: ['USD'],
    },
  },
  ranking: { wMom6m: 0.5, wMom12m: 0.3, wRs6m: 0.2, topN: 10 },
  signals: { breakoutLookback: 20, pullbackMa: 10, minHistory: 252 },
  risk: {
    accountSize: 50000,
    riskPct: 0.01,
    maxPositionPct: 0.6,
    minShares: 1,
    kAtr: 2.0,
    minRr: 2.0,
    maxFeeRiskPct: 0.2,
    regimeEnabled: false,
    regimeTrendSma: 200,
    regimeTrendMultiplier: 0.5,
    regimeVolAtrWindow: 14,
    regimeVolAtrPctThreshold: 6.0,
    regimeVolMultiplier: 0.5,
  },
  manage: {
    breakevenAtR: 1.0,
    trailAfterR: 2.0,
    trailSma: 10,
    smaBufferPct: 0.5,
    maxHoldingDays: 90,
    benchmark: 'SPY',
  },
  backtest: {
    entryType: 'auto',
    exitMode: 'trailing_stop',
    takeProfitR: 3.0,
    maxHoldingDays: 90,
    breakevenAtR: 1.0,
    trailAfterR: 2.0,
    trailSma: 10,
    smaBufferPct: 0.5,
    commissionPct: 0.001,
    minHistory: 252,
  },
  socialOverlay: {
    enabled: false,
    lookbackHours: 24,
    attentionZThreshold: 3.0,
    minSampleSize: 20,
    negativeSentThreshold: -0.4,
    sentimentConfThreshold: 0.7,
    hypePercentileThreshold: 95.0,
    providers: ['reddit'],
    sentimentAnalyzer: 'keyword',
  },
  isDefault: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('isStrategyConfigured', () => {
  it('should return false when strategy is null', () => {
    expect(isStrategyConfigured(null)).toBe(false);
  });

  it('should return false when strategy is undefined', () => {
    expect(isStrategyConfigured(undefined)).toBe(false);
  });

  it('should return true for a properly configured strategy', () => {
    const strategy = createMockStrategy();
    expect(isStrategyConfigured(strategy)).toBe(true);
  });

  it('should return false when account size is 0', () => {
    const strategy = createMockStrategy({
      risk: {
        ...createMockStrategy().risk,
        accountSize: 0,
      },
    });
    expect(isStrategyConfigured(strategy)).toBe(false);
  });

  it('should return false when account size is negative', () => {
    const strategy = createMockStrategy({
      risk: {
        ...createMockStrategy().risk,
        accountSize: -1000,
      },
    });
    expect(isStrategyConfigured(strategy)).toBe(false);
  });

  it('should return false when riskPct is 0', () => {
    const strategy = createMockStrategy({
      risk: {
        ...createMockStrategy().risk,
        riskPct: 0,
      },
    });
    expect(isStrategyConfigured(strategy)).toBe(false);
  });

  it('should return false when maxPositionPct is 0', () => {
    const strategy = createMockStrategy({
      risk: {
        ...createMockStrategy().risk,
        maxPositionPct: 0,
      },
    });
    expect(isStrategyConfigured(strategy)).toBe(false);
  });

  it('should return false when both riskPct and maxPositionPct are invalid', () => {
    const strategy = createMockStrategy({
      risk: {
        ...createMockStrategy().risk,
        riskPct: 0,
        maxPositionPct: 0,
      },
    });
    expect(isStrategyConfigured(strategy)).toBe(false);
  });
});

describe('getStrategyReadiness', () => {
  it('should return not ready when strategy is null', () => {
    const readiness = getStrategyReadiness(null, false);
    
    expect(readiness.isReady).toBe(false);
    expect(readiness.hasActiveStrategy).toBe(false);
    expect(readiness.hasValidAccountSize).toBe(false);
    expect(readiness.hasValidRiskParams).toBe(false);
    expect(readiness.isLoading).toBe(false);
    expect(readiness.issues).toContain('No active strategy');
  });

  it('should return ready for a properly configured strategy', () => {
    const strategy = createMockStrategy();
    const readiness = getStrategyReadiness(strategy, false);
    
    expect(readiness.isReady).toBe(true);
    expect(readiness.hasActiveStrategy).toBe(true);
    expect(readiness.hasValidAccountSize).toBe(true);
    expect(readiness.hasValidRiskParams).toBe(true);
    expect(readiness.isLoading).toBe(false);
    expect(readiness.issues).toHaveLength(0);
  });

  it('should include account size issue when invalid', () => {
    const strategy = createMockStrategy({
      risk: {
        ...createMockStrategy().risk,
        accountSize: 0,
      },
    });
    const readiness = getStrategyReadiness(strategy, false);
    
    expect(readiness.isReady).toBe(false);
    expect(readiness.hasValidAccountSize).toBe(false);
    expect(readiness.issues).toContain('Account size must be greater than 0');
  });

  it('should include risk percentage issue when invalid', () => {
    const strategy = createMockStrategy({
      risk: {
        ...createMockStrategy().risk,
        riskPct: 0,
      },
    });
    const readiness = getStrategyReadiness(strategy, false);
    
    expect(readiness.isReady).toBe(false);
    expect(readiness.hasValidRiskParams).toBe(false);
    expect(readiness.issues).toContain('Risk percentage must be greater than 0');
  });

  it('should include max position percentage issue when invalid', () => {
    const strategy = createMockStrategy({
      risk: {
        ...createMockStrategy().risk,
        maxPositionPct: 0,
      },
    });
    const readiness = getStrategyReadiness(strategy, false);
    
    expect(readiness.isReady).toBe(false);
    expect(readiness.hasValidRiskParams).toBe(false);
    expect(readiness.issues).toContain('Max position percentage must be greater than 0');
  });

  it('should include multiple issues when strategy has multiple problems', () => {
    const strategy = createMockStrategy({
      risk: {
        ...createMockStrategy().risk,
        accountSize: 0,
        riskPct: 0,
        maxPositionPct: 0,
      },
    });
    const readiness = getStrategyReadiness(strategy, false);
    
    expect(readiness.isReady).toBe(false);
    expect(readiness.issues.length).toBeGreaterThan(1);
    expect(readiness.issues).toContain('Account size must be greater than 0');
    expect(readiness.issues).toContain('Risk percentage must be greater than 0');
    expect(readiness.issues).toContain('Max position percentage must be greater than 0');
  });

  it('should preserve loading state', () => {
    const strategy = createMockStrategy();
    const readiness = getStrategyReadiness(strategy, true);
    
    expect(readiness.isLoading).toBe(true);
  });
});

describe('useStrategyReadiness', () => {
  it('should return not ready when no active strategy', () => {
    mockUseActiveStrategyQuery.mockReturnValue({
      data: null,
      isLoading: false,
    });
    
    const { result } = renderHook(() => useStrategyReadiness());
    
    expect(result.current.isReady).toBe(false);
    expect(result.current.hasActiveStrategy).toBe(false);
  });

  it('should return ready when strategy is properly configured', () => {
    const strategy = createMockStrategy();
    mockUseActiveStrategyQuery.mockReturnValue({
      data: strategy,
      isLoading: false,
    });
    
    const { result } = renderHook(() => useStrategyReadiness());
    
    expect(result.current.isReady).toBe(true);
    expect(result.current.hasActiveStrategy).toBe(true);
    expect(result.current.hasValidAccountSize).toBe(true);
    expect(result.current.hasValidRiskParams).toBe(true);
    expect(result.current.issues).toHaveLength(0);
  });

  it('should return not ready when strategy has invalid configuration', () => {
    const strategy = createMockStrategy({
      risk: {
        ...createMockStrategy().risk,
        accountSize: 0,
      },
    });
    mockUseActiveStrategyQuery.mockReturnValue({
      data: strategy,
      isLoading: false,
    });
    
    const { result } = renderHook(() => useStrategyReadiness());
    
    expect(result.current.isReady).toBe(false);
    expect(result.current.hasValidAccountSize).toBe(false);
    expect(result.current.issues.length).toBeGreaterThan(0);
  });

  it('should preserve loading state from query', () => {
    mockUseActiveStrategyQuery.mockReturnValue({
      data: null,
      isLoading: true,
    });
    
    const { result } = renderHook(() => useStrategyReadiness());
    
    expect(result.current.isLoading).toBe(true);
  });
});
