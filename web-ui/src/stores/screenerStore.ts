import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ScreenerResponse } from '@/features/screener/types';
import { prioritizeCandidates } from '@/features/screener/prioritization';
import { indexedDbStorage } from '@/stores/idbStorage';

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
      // IndexedDB (not localStorage) so the full result, including per-candidate
      // OHLCV price histories, survives reloads without exceeding the storage
      // quota for large universes (e.g. S&P 500). Charts stay populated after a
      // reload instead of going empty.
      storage: createJSONStorage(() => indexedDbStorage),
    }
  )
);
