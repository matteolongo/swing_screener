import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '@/types/config';
import { useBacktestForm } from '@/features/backtest/useBacktestForm';

const STORAGE_KEY = 'backtest.params.v1';

describe('useBacktestForm', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it('initializes with defaults from config', () => {
    const { result } = renderHook(() =>
      useBacktestForm({
        config: DEFAULT_CONFIG,
        strategyKAtr: DEFAULT_CONFIG.risk.kAtr,
      }),
    );

    expect(result.current.formState.entryType).toBe('auto');
    expect(result.current.formState.breakoutLookback).toBe(DEFAULT_CONFIG.indicators.breakoutLookback);
    expect(result.current.formState.kAtr).toBe(DEFAULT_CONFIG.risk.kAtr);
    expect(result.current.canRun).toBe(false);
  });

  it('builds run params from tickers and state', () => {
    const { result } = renderHook(() =>
      useBacktestForm({
        config: DEFAULT_CONFIG,
        strategyKAtr: 2.4,
      }),
    );

    act(() => {
      result.current.setFormState((prev) => ({
        ...prev,
        tickersText: 'aapl, msft',
        investedBudget: 10000,
      }));
    });

    const params = result.current.buildRunParams();
    expect(result.current.canRun).toBe(true);
    expect(params.tickers).toEqual(['AAPL', 'MSFT']);
    expect(params.investedBudget).toBe(10000);
  });

  it('resets tactical fields to settings without clearing tickers', () => {
    const { result } = renderHook(() =>
      useBacktestForm({
        config: DEFAULT_CONFIG,
        strategyKAtr: 2.1,
      }),
    );

    act(() => {
      result.current.setFormState((prev) => ({
        ...prev,
        tickersText: 'NVDA',
        kAtr: 9.9,
        breakoutLookback: 99,
      }));
    });

    act(() => {
      result.current.resetToSettings();
    });

    expect(result.current.formState.tickersText).toBe('NVDA');
    expect(result.current.formState.kAtr).toBe(2.1);
    expect(result.current.formState.breakoutLookback).toBe(DEFAULT_CONFIG.indicators.breakoutLookback);
  });
});
