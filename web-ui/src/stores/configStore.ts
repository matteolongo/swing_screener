import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppConfig, DEFAULT_CONFIG } from '@/types/config';

interface ConfigStore {
  config: AppConfig;
  updateConfig: (updates: Partial<AppConfig>) => void;
  updateRisk: (updates: Partial<AppConfig['risk']>) => void;
  updateIndicators: (updates: Partial<AppConfig['indicators']>) => void;
  updateManage: (updates: Partial<AppConfig['manage']>) => void;
  resetToDefaults: () => void;
}

export const useConfigStore = create<ConfigStore>()(
  persist(
    (set) => ({
      config: DEFAULT_CONFIG,
      
      updateConfig: (updates) =>
        set((state) => ({
          config: { ...state.config, ...updates },
        })),
      
      updateRisk: (updates) =>
        set((state) => ({
          config: {
            ...state.config,
            risk: { ...state.config.risk, ...updates },
          },
        })),
      
      updateIndicators: (updates) =>
        set((state) => ({
          config: {
            ...state.config,
            indicators: { ...state.config.indicators, ...updates },
          },
        })),
      
      updateManage: (updates) =>
        set((state) => ({
          config: {
            ...state.config,
            manage: { ...state.config.manage, ...updates },
          },
        })),
      
      resetToDefaults: () =>
        set({ config: DEFAULT_CONFIG }),
    }),
    {
      name: 'swing-screener-config',
    }
  )
);
