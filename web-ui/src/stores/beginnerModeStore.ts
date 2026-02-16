import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface BeginnerModeStore {
  isBeginnerMode: boolean;
  setBeginnerMode: (enabled: boolean) => void;
  toggleBeginnerMode: () => void;
}

export const useBeginnerModeStore = create<BeginnerModeStore>()(
  persist(
    (set) => ({
      isBeginnerMode: true, // Default to Beginner Mode ON for new users
      setBeginnerMode: (enabled) => set({ isBeginnerMode: enabled }),
      toggleBeginnerMode: () => set((state) => ({ isBeginnerMode: !state.isBeginnerMode })),
    }),
    {
      name: 'swing-screener-beginner-mode',
    }
  )
);
