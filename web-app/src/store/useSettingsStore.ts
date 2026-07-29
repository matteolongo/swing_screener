import { create } from 'zustand';

interface SettingsState {
  intradayNewsWindow: number;
  alertToggles: Record<string, boolean>;
  soundEnabled: boolean;

  setIntradayNewsWindow: (hours: number) => void;
  toggleAlert: (type: string) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setSetting: (key: string, value: unknown) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  intradayNewsWindow: 4,
  alertToggles: {},
  soundEnabled: true,

  setIntradayNewsWindow: (hours) => set({ intradayNewsWindow: hours }),

  toggleAlert: (type) =>
    set((s) => ({
      alertToggles: {
        ...s.alertToggles,
        [type]: !(s.alertToggles[type] ?? true),
      },
    })),

  setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),

  setSetting: (key, value) => {
    if (key === 'intradayNewsWindow') {
      set({ intradayNewsWindow: value as number });
    } else if (key === 'soundEnabled') {
      set({ soundEnabled: value as boolean });
    } else if (key.startsWith('alerts.')) {
      const alertKey = key.slice(7);
      set((s) => ({
        alertToggles: { ...s.alertToggles, [alertKey]: value as boolean },
      }));
    }
  },
}));
