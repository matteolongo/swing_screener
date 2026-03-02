import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ActiveStrategyState {
  activeStrategyId: string | null;
  setActiveStrategyId: (id: string) => void;
}

export const useActiveStrategyStore = create<ActiveStrategyState>()(
  persist(
    (set) => ({
      activeStrategyId: null,
      setActiveStrategyId: (id) => set({ activeStrategyId: id }),
    }),
    {
      name: 'swing-screener-active-strategy',
    }
  )
);
