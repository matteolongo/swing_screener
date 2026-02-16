import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserPreferencesState {
  // Onboarding state
  onboardingCompleted: boolean;
  onboardingStep: number;
  onboardingDismissed: boolean;
  
  // Beginner mode preference (persistent)
  isBeginnerMode: boolean;
  
  // Actions
  completeOnboarding: () => void;
  setOnboardingStep: (step: number) => void;
  dismissOnboarding: () => void;
  resetOnboarding: () => void;
  setBeginnerMode: (enabled: boolean) => void;
}

export const useUserPreferencesStore = create<UserPreferencesState>()(
  persist(
    (set) => ({
      // Default state for new users
      onboardingCompleted: false,
      onboardingStep: 0,
      onboardingDismissed: false,
      isBeginnerMode: true,
      
      completeOnboarding: () =>
        set({
          onboardingCompleted: true,
          onboardingStep: 4,
        }),
      
      setOnboardingStep: (step: number) =>
        set({ onboardingStep: step }),
      
      dismissOnboarding: () =>
        set({ onboardingDismissed: true }),
      
      resetOnboarding: () =>
        set({
          onboardingCompleted: false,
          onboardingStep: 0,
          onboardingDismissed: false,
        }),
      
      setBeginnerMode: (enabled: boolean) =>
        set({ isBeginnerMode: enabled }),
    }),
    {
      name: 'swing-screener-user-prefs',
    }
  )
);
