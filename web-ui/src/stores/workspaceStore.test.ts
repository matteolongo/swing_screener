import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useWorkspaceStore } from './workspaceStore';

describe('useWorkspaceStore', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      selectedTicker: null,
      selectedTickerSource: null,
      analysisTab: 'overview',
      runScreenerTrigger: 0,
    });
  });

  it('normalizes selected ticker to upper-case and defaults source to screener', () => {
    const { result } = renderHook(() => useWorkspaceStore());

    act(() => result.current.setSelectedTicker('  aapl '));

    expect(result.current.selectedTicker).toBe('AAPL');
    expect(result.current.selectedTickerSource).toBe('screener');
  });

  it('honors an explicit source', () => {
    const { result } = renderHook(() => useWorkspaceStore());

    act(() => result.current.setSelectedTicker('msft', 'portfolio'));

    expect(result.current.selectedTickerSource).toBe('portfolio');
  });

  it('clears source when ticker is null', () => {
    const { result } = renderHook(() => useWorkspaceStore());

    act(() => result.current.setSelectedTicker(null));

    expect(result.current.selectedTicker).toBeNull();
    expect(result.current.selectedTickerSource).toBeNull();
  });

  it('resets ticker, source and tab on clear', () => {
    const { result } = renderHook(() => useWorkspaceStore());

    act(() => {
      result.current.setSelectedTicker('aapl', 'portfolio');
      result.current.setAnalysisTab('fundamentals');
      result.current.clearSelectedTicker();
    });

    expect(result.current.selectedTicker).toBeNull();
    expect(result.current.selectedTickerSource).toBeNull();
    expect(result.current.analysisTab).toBe('overview');
  });

  it('increments the run-screener trigger', () => {
    const { result } = renderHook(() => useWorkspaceStore());

    act(() => result.current.requestRunScreener());
    act(() => result.current.requestRunScreener());

    expect(result.current.runScreenerTrigger).toBe(2);
  });
});
