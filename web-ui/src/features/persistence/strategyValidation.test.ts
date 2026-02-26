import { describe, expect, it } from 'vitest';
import { validateStrategyLocally } from '@/features/persistence/strategyValidation';
import { toStrategyUpdateRequest } from '@/features/strategy/types';
import { createDefaultStrategy } from '@/features/persistence/schema';

describe('validateStrategyLocally', () => {
  it('returns beginner-safe for default strategy', () => {
    const payload = toStrategyUpdateRequest(createDefaultStrategy());
    const result = validateStrategyLocally(payload);

    expect(result.isValid).toBe(true);
    expect(result.safetyLevel).toBe('beginner-safe');
    expect(result.dangerCount).toBe(0);
  });

  it('returns danger warnings for aggressive settings', () => {
    const strategy = createDefaultStrategy();
    strategy.signals.breakoutLookback = 10;
    strategy.risk.minRr = 1.2;
    strategy.risk.riskPct = 0.05;
    strategy.universe.filt.maxAtrPct = 30;

    const payload = toStrategyUpdateRequest(strategy);
    const result = validateStrategyLocally(payload);

    expect(result.isValid).toBe(false);
    expect(result.dangerCount).toBeGreaterThan(0);
    expect(result.safetyScore).toBeLessThan(70);
    expect(result.safetyLevel).toBe('expert-only');
  });
});
