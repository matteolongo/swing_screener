import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
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

// localStorage that never throws on quota: persistence is a convenience, not
// correctness, so a failed write degrades to in-memory-only instead of crashing.
const safeLocalStorage: StateStorage = {
  getItem: (name) => localStorage.getItem(name),
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch (error) {
      console.warn(`screener result not persisted (storage quota): ${String(error)}`);
    }
  },
  removeItem: (name) => localStorage.removeItem(name),
};

// Drop the heavy per-candidate price-history arrays from the persisted copy.
// They stay in memory for the live session (charts work); after a reload the
// table rehydrates without histories until the next screener run. This keeps the
// payload well under the localStorage quota for large universes (e.g. S&P 500).
function stripHeavyFields(result: ScreenerResponse): ScreenerResponse {
  return {
    ...result,
    candidates: result.candidates.map((candidate) => {
      const slim = { ...candidate };
      delete slim.priceHistory;
      delete slim.benchmarkPriceHistory;
      return slim;
    }),
  };
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
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({
        lastResult: state.lastResult ? stripHeavyFields(state.lastResult) : null,
      }),
    }
  )
);
