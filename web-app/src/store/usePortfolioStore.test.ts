import { describe, it, expect, beforeEach } from 'vitest';
import { usePortfolioStore } from './usePortfolioStore';

beforeEach(() => {
  usePortfolioStore.setState({
    positions: [],
    dailyReview: null,
    selectedPositionId: null,
    isLoading: false,
  });
});

describe('usePortfolioStore', () => {
  it('sets selected position id', () => {
    usePortfolioStore.getState().setSelectedPositionId('pos-1');
    expect(usePortfolioStore.getState().selectedPositionId).toBe('pos-1');
  });

  it('clears selected position id', () => {
    usePortfolioStore.getState().setSelectedPositionId('pos-1');
    usePortfolioStore.getState().setSelectedPositionId(null);
    expect(usePortfolioStore.getState().selectedPositionId).toBeNull();
  });
});
