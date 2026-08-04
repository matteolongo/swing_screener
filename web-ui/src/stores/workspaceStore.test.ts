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
      activities: [],
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

  it('tracks concurrent requests independently and preserves discarded history', () => {
    const state = useWorkspaceStore.getState();
    state.beginActivity({
      requestId: 'prices-1',
      ticker: 'aapl',
      selectionVersion: 1,
      sourceId: 'prices',
      phase: 'active',
      startedAt: '2026-07-29T09:00:00Z',
      finishedAt: null,
      provider: null,
      message: null,
      retryable: false,
      pipelineStep: null,
      announced: false,
    });
    state.beginActivity({
      requestId: 'prices-2',
      ticker: 'AAPL',
      selectionVersion: 1,
      sourceId: 'prices',
      phase: 'active',
      startedAt: '2026-07-29T09:01:00Z',
      finishedAt: null,
      provider: null,
      message: null,
      retryable: false,
      pipelineStep: null,
      announced: false,
    });
    state.settleActivity('prices-1', {
      phase: 'discarded',
      finishedAt: '2026-07-29T09:02:00Z',
      message: 'Selection changed',
    });

    expect(useWorkspaceStore.getState().activities).toMatchObject([
      { requestId: 'prices-2', phase: 'active' },
      { requestId: 'prices-1', phase: 'discarded', ticker: 'AAPL' },
    ]);
  });

  it('dismisses one request and marks one failure announced', () => {
    const state = useWorkspaceStore.getState();
    for (const requestId of ['failure-1', 'failure-2']) {
      state.beginActivity({
        requestId,
        ticker: 'AAPL',
        selectionVersion: 1,
        sourceId: 'fundamentals',
        phase: 'active',
        startedAt: '2026-07-29T09:00:00Z',
        finishedAt: null,
        provider: null,
        message: null,
        retryable: false,
        pipelineStep: null,
        announced: false,
      });
      state.settleActivity(requestId, {
        phase: 'failed',
        finishedAt: '2026-07-29T09:01:00Z',
        message: 'Failed',
      });
    }

    state.markActivityAnnounced('failure-2');
    state.dismissActivity('failure-1');

    expect(useWorkspaceStore.getState().activities).toEqual([
      expect.objectContaining({ requestId: 'failure-2', announced: true }),
    ]);
  });

  it('increments the run-screener trigger', () => {
    const { result } = renderHook(() => useWorkspaceStore());

    act(() => result.current.requestRunScreener());
    act(() => result.current.requestRunScreener());

    expect(result.current.runScreenerTrigger).toBe(2);
  });
});
