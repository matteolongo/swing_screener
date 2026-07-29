import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './useAppStore';

beforeEach(() => {
  useAppStore.setState({
    activeTab: 'screener',
    mode: 'eod',
    alerts: [],
    accountSize: 50000,
    drawerOpen: false,
  });
  localStorage.clear();
});

describe('useAppStore', () => {
  it('sets active tab', () => {
    useAppStore.getState().setActiveTab('watchlist');
    expect(useAppStore.getState().activeTab).toBe('watchlist');
  });

  it('sets mode', () => {
    useAppStore.getState().setMode('intraday');
    expect(useAppStore.getState().mode).toBe('intraday');
  });

  it('adds and dismisses alerts', () => {
    const alert = {
      id: 'a1',
      type: 'exhaustion' as const,
      symbol: 'AAPL',
      message: 'Exhaustion detected',
      timestamp: '2025-01-15T20:00:00Z',
    };

    useAppStore.getState().addAlert(alert);
    expect(useAppStore.getState().alerts).toHaveLength(1);
    expect(useAppStore.getState().alerts[0].symbol).toBe('AAPL');

    useAppStore.getState().dismissAlert('a1');
    expect(useAppStore.getState().alerts).toHaveLength(0);
  });

  it('sets account size', () => {
    useAppStore.getState().setAccountSize(100000);
    expect(useAppStore.getState().accountSize).toBe(100000);
  });

  it('persists accountSize to localStorage', () => {
    useAppStore.getState().setAccountSize(75000);
    const raw = localStorage.getItem('app-store');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.accountSize).toBe(75000);
  });
});
