import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ScreenerRequest, ScreenerResponse } from '@/features/screener/types';
import { prioritizeCandidates, type DecisionActionFilter } from '@/features/screener/prioritization';
import { indexedDbStorage } from '@/stores/idbStorage';

export interface TodayRunDisplayFilters {
  recommendedOnly: boolean;
  actionFilter: DecisionActionFilter;
}

export interface ScreenerRunContext {
  request: ScreenerRequest;
  displayFilters: TodayRunDisplayFilters;
  completedAt: string;
}

export interface TodayRunSnapshot extends ScreenerRunContext {
  result: ScreenerResponse;
}

interface ScreenerStore {
  lastResult: ScreenerResponse | null;
  /** Request/display context for the result in Last Run. */
  lastRunContext: ScreenerRunContext | null;
  /** The immutable screener snapshot that powers Today's opportunities. */
  todayRun: TodayRunSnapshot | null;
  /** Prevents legacy persisted results from being promoted more than once. */
  todayRunInitialized: boolean;
  setLastResult: (result: ScreenerResponse) => void;
  recordScreenerRun: (
    result: ScreenerResponse,
    context: Omit<ScreenerRunContext, 'completedAt'> & { completedAt?: string },
    useForToday: boolean,
  ) => void;
  setTodayRunFromLastRun: () => void;
  setTodayRunDisplayFilters: (filters: TodayRunDisplayFilters) => void;
  initializeTodayRunFromLegacyResult: () => void;
  /** A strategy change makes persisted recommendations historical, not actionable. */
  invalidateActionableRuns: () => void;
  clearLastResult: () => void;
  patchCandidate: (
    ticker: string,
    updater: (candidate: ScreenerResponse['candidates'][number]) => ScreenerResponse['candidates'][number]
  ) => void;
}

export const useScreenerStore = create<ScreenerStore>()(
  persist(
    (set, get) => ({
      lastResult: null,
      lastRunContext: null,
      todayRun: null,
      todayRunInitialized: false,
      setLastResult: (result) =>
        set({
          lastResult: {
            ...result,
            candidates: prioritizeCandidates(result.candidates),
          },
        }),
      recordScreenerRun: (result, context, useForToday) => {
        const normalizedResult = {
          ...result,
          candidates: prioritizeCandidates(result.candidates),
        };
        const resolvedContext: ScreenerRunContext = {
          ...context,
          completedAt: context.completedAt ?? new Date().toISOString(),
        };
        set((state) => ({
          lastResult: normalizedResult,
          lastRunContext: resolvedContext,
          todayRun: useForToday
            ? { ...resolvedContext, result: normalizedResult }
            : state.todayRun,
          todayRunInitialized: true,
        }));
      },
      setTodayRunFromLastRun: () => {
        const { lastResult, lastRunContext } = get();
        if (!lastResult) return;
        const context: ScreenerRunContext = lastRunContext ?? {
          request: {},
          displayFilters: { recommendedOnly: false, actionFilter: 'all' },
          completedAt: new Date().toISOString(),
        };
        set({ todayRun: { ...context, result: lastResult }, todayRunInitialized: true });
      },
      setTodayRunDisplayFilters: (displayFilters) =>
        set((state) => ({
          todayRun: state.todayRun ? { ...state.todayRun, displayFilters } : null,
        })),
      initializeTodayRunFromLegacyResult: () => {
        const { todayRunInitialized, todayRun, lastResult } = get();
        if (todayRunInitialized || todayRun) return;
        set({ todayRunInitialized: true });
        if (lastResult) get().setTodayRunFromLastRun();
      },
      invalidateActionableRuns: () => set({
        lastResult: null,
        lastRunContext: null,
        todayRun: null,
        todayRunInitialized: true,
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
      // IndexedDB rehydrates asynchronously. Perform the one-time legacy
      // promotion only after the old Last Run, if any, is present in state.
      onRehydrateStorage: () => (state) => {
        state?.initializeTodayRunFromLegacyResult();
      },
    }
  )
);
