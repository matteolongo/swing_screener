import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from './useSettingsStore';

beforeEach(() => {
  useSettingsStore.setState({ intradayNewsWindow: 4, alertToggles: {} });
});

describe('useSettingsStore', () => {
  it('sets intraday news window', () => {
    useSettingsStore.getState().setIntradayNewsWindow(8);
    expect(useSettingsStore.getState().intradayNewsWindow).toBe(8);
  });

  it('toggles alert from true to false', () => {
    useSettingsStore.getState().toggleAlert('exhaustion');
    expect(useSettingsStore.getState().alertToggles['exhaustion']).toBe(false);
  });

  it('toggles alert from false to true', () => {
    useSettingsStore.getState().toggleAlert('exhaustion');
    useSettingsStore.getState().toggleAlert('exhaustion');
    expect(useSettingsStore.getState().alertToggles['exhaustion']).toBe(true);
  });

  it('defaults unknown alert to true before toggle', () => {
    expect(useSettingsStore.getState().alertToggles['stop-trigger'] ?? true).toBe(true);
  });
});
