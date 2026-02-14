import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ScreenerResponse } from '@/features/screener/types';

interface ScreenerStore {
  lastResult: ScreenerResponse | null;
  setLastResult: (result: ScreenerResponse) => void;
  clearLastResult: () => void;
}

export const useScreenerStore = create<ScreenerStore>()(
  persist(
    (set) => ({
      lastResult: null,
      setLastResult: (result) => set({ lastResult: result }),
      clearLastResult: () => set({ lastResult: null }),
    }),
    {
      name: 'swing-screener-last-result',
    }
  )
);
