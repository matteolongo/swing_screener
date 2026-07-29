import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type TabId = 'screener' | 'watchlist' | 'ai' | 'daily-review';

interface AlertItem {
  id: string;
  type: 'exhaustion' | 'stop-trigger' | 'concentration' | 'provider-failure' | 'intraday-rr';
  symbol?: string;
  positionId?: string;
  message: string;
  timestamp: string;
}

interface AppState {
  activeTab: TabId;
  mode: 'eod' | 'intraday';
  alerts: AlertItem[];
  accountSize: number;
  drawerOpen: boolean;
  setActiveTab: (tab: TabId) => void;
  setMode: (mode: 'eod' | 'intraday') => void;
  addAlert: (alert: AlertItem) => void;
  dismissAlert: (id: string) => void;
  setAccountSize: (size: number) => void;
  toggleDrawer: () => void;
  setDrawerOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeTab: 'screener',
      mode: 'eod',
      alerts: [],
      accountSize: 50000,
      drawerOpen: false,
      setActiveTab: (tab) => set({ activeTab: tab }),
      setMode: (mode) => set({ mode }),
      addAlert: (alert) => set((s) => ({ alerts: [...s.alerts, alert] })),
      dismissAlert: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),
      setAccountSize: (size) => set({ accountSize: size }),
      toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
      setDrawerOpen: (open) => set({ drawerOpen: open }),
    }),
    { name: 'app-store', partialize: (state) => ({ accountSize: state.accountSize }) },
  ),
);

export type { TabId, AlertItem };
