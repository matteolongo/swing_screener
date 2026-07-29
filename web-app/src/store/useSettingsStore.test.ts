import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from './useSettingsStore';

beforeEach(() => {
  useSettingsStore.setState({ intradayNewsWindow: 4, alertToggles: {}, soundEnabled: true });
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

  it('sets sound enabled via setSetting', () => {
    useSettingsStore.getState().setSetting('soundEnabled', false);
    expect(useSettingsStore.getState().soundEnabled).toBe(false);
  });

  it('sets intraday news window via setSetting', () => {
    useSettingsStore.getState().setSetting('intradayNewsWindow', 6);
    expect(useSettingsStore.getState().intradayNewsWindow).toBe(6);
  });

  it('sets alert toggle via setSetting with alerts. prefix', () => {
    useSettingsStore.getState().setSetting('alerts.provider-failure', false);
    expect(useSettingsStore.getState().alertToggles['provider-failure']).toBe(false);
  });
});
