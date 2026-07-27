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
      workspaceMode: 'split',
      selectionVersion: 0,
      activityDrawerOpen: false,
      fullscreen: false,
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

  it('increments the selection version and expands on a new ticker', () => {
    useWorkspaceStore.getState().setSelectedTicker('aapl', 'screener');
    const first = useWorkspaceStore.getState();
    expect(first.workspaceMode).toBe('expanded');
    expect(first.selectionVersion).toBe(1);

    useWorkspaceStore.getState().setSelectedTicker('msft', 'screener');
    expect(useWorkspaceStore.getState().selectionVersion).toBe(2);
  });

  it('does not increment the selection version for the same normalized ticker', () => {
    useWorkspaceStore.getState().setSelectedTicker('aapl', 'screener');
    useWorkspaceStore.getState().setSelectedTicker(' AAPL ', 'portfolio');

    expect(useWorkspaceStore.getState().selectionVersion).toBe(1);
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
      result.current.setFullscreen(true);
      result.current.clearSelectedTicker();
    });

    expect(result.current.selectedTicker).toBeNull();
    expect(result.current.selectedTickerSource).toBeNull();
    expect(result.current.analysisTab).toBe('overview');
    expect(result.current.workspaceMode).toBe('split');
    expect(result.current.fullscreen).toBe(false);
  });

  it('collapses an expanded workspace without clearing its selection', () => {
    useWorkspaceStore.getState().setSelectedTicker('aapl');
    useWorkspaceStore.getState().collapseWorkspace();

    const state = useWorkspaceStore.getState();
    expect(state.workspaceMode).toBe('split');
    expect(state.selectedTicker).toBe('AAPL');
  });

  it('controls the activity drawer and fullscreen explicitly', () => {
    useWorkspaceStore.getState().setActivityDrawerOpen(true);
    useWorkspaceStore.getState().setFullscreen(true);

    expect(useWorkspaceStore.getState().activityDrawerOpen).toBe(true);
    expect(useWorkspaceStore.getState().fullscreen).toBe(true);
  });

  it('increments the run-screener trigger', () => {
    const { result } = renderHook(() => useWorkspaceStore());

    act(() => result.current.requestRunScreener());
    act(() => result.current.requestRunScreener());

    expect(result.current.runScreenerTrigger).toBe(2);
  });
});
