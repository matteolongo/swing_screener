import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserMode = 'beginner' | 'advanced';

interface UserPreferencesStore {
  mode: UserMode;
  setMode: (mode: UserMode) => void;
  toggleMode: () => void;
  isBeginnerMode: () => boolean;
}

export const useUserPreferencesStore = create<UserPreferencesStore>()(
  persist(
    (set, get) => ({
      mode: 'beginner', // Default to beginner mode for new users
      
      setMode: (mode) => set({ mode }),
      
      toggleMode: () => 
        set((state) => ({
          mode: state.mode === 'beginner' ? 'advanced' : 'beginner',
        })),
      
      isBeginnerMode: () => get().mode === 'beginner',
    }),
    {
      name: 'swing-screener-user-preferences',
    }
  )
);
