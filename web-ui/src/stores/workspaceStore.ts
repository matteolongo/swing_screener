import { create } from 'zustand';

interface WorkspaceStore {
  selectedTicker: string | null;
  setSelectedTicker: (ticker: string | null) => void;
  clearSelectedTicker: () => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()((set) => ({
  selectedTicker: null,
  setSelectedTicker: (ticker) => set({ selectedTicker: ticker ? ticker.trim().toUpperCase() : null }),
  clearSelectedTicker: () => set({ selectedTicker: null }),
}));
