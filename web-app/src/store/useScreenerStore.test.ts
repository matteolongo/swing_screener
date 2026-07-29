import { describe, it, expect, beforeEach } from 'vitest';
import { useScreenerStore } from './useScreenerStore';
import type { CandidateRow } from '../types/api';

const mockCandidates: CandidateRow[] = [
  {
    rank: 1, symbol: 'AAPL', exchange_mic: 'XNAS', setup: 'Momentum',
    entry: 180, stop: 170, rr: 2.5, risk_usd: 500, shares: 50,
    sector: 'Tech', price: 182, close: 181,
  },
];

beforeEach(() => {
  useScreenerStore.setState({
    candidates: [],
    universe: 'us_sp500',
    preset: null,
    sortBy: 'score',
    isLoading: false,
    error: null,
  });
});

describe('useScreenerStore', () => {
  it('sets candidates', () => {
    useScreenerStore.getState().setCandidates(mockCandidates);
    expect(useScreenerStore.getState().candidates).toHaveLength(1);
    expect(useScreenerStore.getState().candidates[0].symbol).toBe('AAPL');
  });

  it('sets universe', () => {
    useScreenerStore.getState().setUniverse('us_nasdaq100');
    expect(useScreenerStore.getState().universe).toBe('us_nasdaq100');
  });

  it('sets preset', () => {
    useScreenerStore.getState().setPreset('us-mega');
    expect(useScreenerStore.getState().preset).toBe('us-mega');
  });

  it('sets sortBy', () => {
    useScreenerStore.getState().setSortBy('rr');
    expect(useScreenerStore.getState().sortBy).toBe('rr');
  });

  it('sets loading', () => {
    useScreenerStore.getState().setLoading(true);
    expect(useScreenerStore.getState().isLoading).toBe(true);
  });

  it('sets error', () => {
    useScreenerStore.getState().setError('Something went wrong');
    expect(useScreenerStore.getState().error).toBe('Something went wrong');
  });
});
