import { create } from 'zustand';

interface SettingsState {
  intradayNewsWindow: number;
  alertToggles: Record<string, boolean>;

  setIntradayNewsWindow: (hours: number) => void;
  toggleAlert: (type: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  intradayNewsWindow: 4,
  alertToggles: {},

  setIntradayNewsWindow: (hours) => set({ intradayNewsWindow: hours }),

  toggleAlert: (type) =>
    set((s) => ({
      alertToggles: {
        ...s.alertToggles,
        [type]: !(s.alertToggles[type] ?? true),
      },
    })),
}));
