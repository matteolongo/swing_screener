import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useOrderRiskMetrics } from './useOrderRiskMetrics';

describe('useOrderRiskMetrics', () => {
  it('computes position size, risk amount and percentages', () => {
    const { result } = renderHook(() =>
      useOrderRiskMetrics({ limitPrice: 100, stopPrice: 90, quantity: 10, accountSize: 10_000 })
    );

    expect(result.current.positionSize).toBe(1000); // 100 * 10
    expect(result.current.riskAmount).toBe(100); // (100 - 90) * 10
    expect(result.current.accountPercent).toBe(10); // 1000 / 10000
    expect(result.current.riskPercent).toBe(1); // 100 / 10000
  });

  it('returns zero percentages when account size is zero (no divide-by-zero)', () => {
    const { result } = renderHook(() =>
      useOrderRiskMetrics({ limitPrice: 100, stopPrice: 90, quantity: 10, accountSize: 0 })
    );

    expect(result.current.accountPercent).toBe(0);
    expect(result.current.riskPercent).toBe(0);
  });

  it('treats a non-positive stop as zero risk', () => {
    const { result } = renderHook(() =>
      useOrderRiskMetrics({ limitPrice: 100, stopPrice: 0, quantity: 5, accountSize: 1000 })
    );

    expect(result.current.riskAmount).toBe(0);
    expect(result.current.positionSize).toBe(500);
  });

  it('clamps negative inputs to zero', () => {
    const { result } = renderHook(() =>
      useOrderRiskMetrics({ limitPrice: -100, stopPrice: 90, quantity: -10, accountSize: 1000 })
    );

    expect(result.current.positionSize).toBe(0);
    expect(result.current.riskAmount).toBe(0);
  });
});
