import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ScreenerResponse } from '@/features/screener/types';
import { prioritizeCandidates } from '@/features/screener/prioritization';

interface ScreenerStore {
  lastResult: ScreenerResponse | null;
  setLastResult: (result: ScreenerResponse) => void;
  clearLastResult: () => void;
  patchCandidate: (
    ticker: string,
    updater: (candidate: ScreenerResponse['candidates'][number]) => ScreenerResponse['candidates'][number]
  ) => void;
}

export const useScreenerStore = create<ScreenerStore>()(
  persist(
    (set) => ({
      lastResult: null,
      setLastResult: (result) =>
        set({
          lastResult: {
            ...result,
            candidates: prioritizeCandidates(result.candidates),
          },
        }),
      clearLastResult: () => set({ lastResult: null }),
      patchCandidate: (ticker, updater) =>
        set((state) => {
          if (!state.lastResult) {
            return state;
          }
          const target = ticker.trim().toUpperCase();
          const nextCandidates = state.lastResult.candidates.map((candidate) =>
            candidate.ticker.toUpperCase() === target ? updater(candidate) : candidate
          );
          return {
            lastResult: {
              ...state.lastResult,
              candidates: prioritizeCandidates(nextCandidates),
            },
          };
        }),
    }),
    {
      name: 'swing-screener-last-result',
    }
  )
);
