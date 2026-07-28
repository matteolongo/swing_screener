import { create } from 'zustand';

type TabId = 'screener' | 'watchlist' | 'ai' | 'daily-review';

interface AlertItem {
  id: string;
  type: 'exhaustion' | 'stop-trigger' | 'concentration' | 'provider-failure' | 'intraday-rr';
  symbol?: string;
  message: string;
  timestamp: string;
}

interface AppState {
  activeTab: TabId;
  mode: 'eod' | 'intraday';
  alerts: AlertItem[];
  setActiveTab: (tab: TabId) => void;
  setMode: (mode: 'eod' | 'intraday') => void;
  dismissAlert: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'screener',
  mode: 'eod',
  alerts: [],
  setActiveTab: (tab) => set({ activeTab: tab }),
  setMode: (mode) => set({ mode }),
  dismissAlert: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),
}));

export type { TabId, AlertItem };
