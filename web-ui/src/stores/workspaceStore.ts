import { create } from 'zustand';
import type { WorkspaceAnalysisTab } from '@/components/domain/workspace/types';
import { prependActivity, settleActivity as settleActivityRecord } from '@/features/workspaceData/activity';
import type { WorkspaceActivity, WorkspaceActivitySettlement } from '@/features/workspaceData/types';

export type SelectedTickerSource = 'screener' | 'portfolio' | null;
export type WorkspaceMode = 'split' | 'expanded';

interface WorkspaceStore {
  selectedTicker: string | null;
  selectedTickerSource: SelectedTickerSource;
  analysisTab: WorkspaceAnalysisTab;
  runScreenerTrigger: number;
  workspaceMode: WorkspaceMode;
  selectionVersion: number;
  activityDrawerOpen: boolean;
  activities: WorkspaceActivity[];
  fullscreen: boolean;
  setSelectedTicker: (ticker: string | null, source?: SelectedTickerSource) => void;
  clearSelectedTicker: () => void;
  collapseWorkspace: () => void;
  setActivityDrawerOpen: (open: boolean) => void;
  beginActivity: (activity: WorkspaceActivity) => void;
  settleActivity: (requestId: string, settlement: WorkspaceActivitySettlement) => void;
  dismissActivity: (requestId: string) => void;
  markActivityAnnounced: (requestId: string) => void;
  clearActivities: () => void;
  setFullscreen: (fullscreen: boolean) => void;
  setAnalysisTab: (tab: WorkspaceAnalysisTab) => void;
  requestRunScreener: () => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()((set) => ({
  selectedTicker: null,
  selectedTickerSource: null,
  analysisTab: 'overview',
  runScreenerTrigger: 0,
  workspaceMode: 'split',
  selectionVersion: 0,
  activityDrawerOpen: false,
  activities: [],
  fullscreen: false,
  setSelectedTicker: (ticker, source = 'screener') => {
    const normalized = ticker?.trim();
    const upper = normalized ? normalized.toUpperCase() : null;
    set((state) => ({
      selectedTicker: upper,
      selectedTickerSource: upper ? source : null,
      workspaceMode: upper ? 'expanded' : state.workspaceMode,
      selectionVersion:
        upper && upper !== state.selectedTicker ? state.selectionVersion + 1 : state.selectionVersion,
    }));
  },
  clearSelectedTicker: () =>
    set({
      selectedTicker: null,
      selectedTickerSource: null,
      analysisTab: 'overview',
      workspaceMode: 'split',
      fullscreen: false,
    }),
  collapseWorkspace: () =>
    set((state) => ({ workspaceMode: state.workspaceMode === 'expanded' ? 'split' : state.workspaceMode })),
  setActivityDrawerOpen: (activityDrawerOpen) => set({ activityDrawerOpen }),
  beginActivity: (activity) =>
    set((state) => ({
      activities: prependActivity(state.activities, activity),
      activityDrawerOpen: true,
    })),
  settleActivity: (requestId, settlement) =>
    set((state) => ({
      activities: settleActivityRecord(state.activities, requestId, settlement),
    })),
  dismissActivity: (requestId) =>
    set((state) => ({
      activities: state.activities.filter((activity) => activity.requestId !== requestId),
    })),
  markActivityAnnounced: (requestId) =>
    set((state) => ({
      activities: state.activities.map((activity) =>
        activity.requestId === requestId ? { ...activity, announced: true } : activity),
    })),
  clearActivities: () => set({ activities: [], activityDrawerOpen: false }),
  setFullscreen: (fullscreen) => set({ fullscreen }),
  setAnalysisTab: (tab) => set({ analysisTab: tab }),
  requestRunScreener: () => set((state) => ({ runScreenerTrigger: state.runScreenerTrigger + 1 })),
}));
