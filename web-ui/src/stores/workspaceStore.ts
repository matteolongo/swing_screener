import { create } from 'zustand';
import type { WorkspaceAnalysisTab } from '@/components/domain/workspace/types';
import { prependActivity, settleActivity as settleActivityRecord } from '@/features/workspaceData/activity';
import type { WorkspaceActivity, WorkspaceActivitySettlement } from '@/features/workspaceData/types';
import type { ScreenerCandidate } from '@/features/screener/types';

export type SelectedTickerSource = 'screener' | 'portfolio' | null;
export type WorkspaceSelectionSource =
  | 'today_run'
  | 'last_run'
  | 'today_position'
  | 'today_watchlist'
  | 'portfolio'
  | 'ad_hoc';

export interface WorkspaceSelection {
  ticker: string;
  source: WorkspaceSelectionSource;
  runId?: string;
  candidate?: ScreenerCandidate;
  rowId: string;
}
export type WorkspaceMode = 'split' | 'expanded';

interface WorkspaceStore {
  selectedTicker: string | null;
  selectedTickerSource: SelectedTickerSource;
  /** Canonical source-aware selection. `selectedTicker` remains a compatibility selector. */
  selection: WorkspaceSelection | null;
  analysisTab: WorkspaceAnalysisTab;
  runScreenerTrigger: number;
  workspaceMode: WorkspaceMode;
  selectionVersion: number;
  activityDrawerOpen: boolean;
  activities: WorkspaceActivity[];
  fullscreen: boolean;
  setWorkspaceSelection: (selection: WorkspaceSelection | null) => void;
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

export const useWorkspaceStore = create<WorkspaceStore>()((set, get) => ({
  selectedTicker: null,
  selectedTickerSource: null,
  selection: null,
  analysisTab: 'overview',
  runScreenerTrigger: 0,
  workspaceMode: 'split',
  selectionVersion: 0,
  activityDrawerOpen: false,
  activities: [],
  fullscreen: false,
  setWorkspaceSelection: (selection) => {
    const ticker = selection?.ticker.trim();
    const upper = ticker ? ticker.toUpperCase() : null;
    const normalizedSelection = upper && selection
      ? { ...selection, ticker: upper, rowId: selection.rowId || `${selection.source}:${upper}` }
      : null;
    set((state) => {
      const changed = normalizedSelection?.ticker !== state.selection?.ticker
        || normalizedSelection?.source !== state.selection?.source
        || normalizedSelection?.runId !== state.selection?.runId
        || normalizedSelection?.rowId !== state.selection?.rowId;
      return {
        selectedTicker: upper,
        selectedTickerSource: upper
          ? normalizedSelection?.source === 'portfolio' ? 'portfolio' : 'screener'
          : null,
        selection: normalizedSelection,
        workspaceMode: upper ? 'expanded' : state.workspaceMode,
        selectionVersion: upper && changed ? state.selectionVersion + 1 : state.selectionVersion,
      };
    });
  },
  setSelectedTicker: (ticker, source = 'screener') => {
    const normalized = ticker?.trim();
    const upper = normalized ? normalized.toUpperCase() : null;
    get().setWorkspaceSelection(upper ? {
      ticker: upper,
      source: source === 'portfolio' ? 'portfolio' : 'ad_hoc',
      rowId: `${source === 'portfolio' ? 'portfolio' : 'ad-hoc'}:${upper}`,
    } : null);
  },
  clearSelectedTicker: () =>
    set({
      selectedTicker: null,
      selectedTickerSource: null,
      selection: null,
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
