import { create } from 'zustand';
import type { CandidateRow } from '../types/api';

type SortField = 'score' | 'rr' | 'price';

interface ScreenerState {
  candidates: CandidateRow[];
  universe: string;
  preset: string | null;
  sortBy: SortField;
  isLoading: boolean;
  error: string | null;

  setCandidates: (list: CandidateRow[]) => void;
  setUniverse: (u: string) => void;
  setPreset: (p: string | null) => void;
  setSortBy: (f: SortField) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
}

export const useScreenerStore = create<ScreenerState>((set) => ({
  candidates: [],
  universe: 'us_sp500',
  preset: null,
  sortBy: 'score',
  isLoading: false,
  error: null,

  setCandidates: (list) => set({ candidates: list }),
  setUniverse: (u) => set({ universe: u }),
  setPreset: (p) => set({ preset: p }),
  setSortBy: (f) => set({ sortBy: f }),
  setLoading: (v) => set({ isLoading: v }),
  setError: (e) => set({ error: e }),
}));
