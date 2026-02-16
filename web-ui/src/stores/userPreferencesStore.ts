import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserMode = 'beginner' | 'advanced';

interface UserPreferencesStore {
  mode: UserMode;
  setMode: (mode: UserMode) => void;
  toggleMode: () => void;
  isBeginnerMode: () => boolean;
}

// Check if we're in test environment
const isTestEnvironment = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

export const useUserPreferencesStore = create<UserPreferencesStore>()(
  persist(
    (set, get) => ({
      mode: isTestEnvironment ? 'advanced' : 'beginner', // Default to advanced in tests, beginner in prod
      
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
