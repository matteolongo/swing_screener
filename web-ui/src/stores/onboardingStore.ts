import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type OnboardingStatus = 'new' | 'dismissed' | 'completed';

interface OnboardingStore {
  status: OnboardingStatus;
  currentStep: number;
  setStatus: (status: OnboardingStatus) => void;
  setCurrentStep: (step: number) => void;
  dismissOnboarding: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set) => ({
      status: 'new',
      currentStep: 0,
      setStatus: (status) => set({ status }),
      setCurrentStep: (step) => set({ currentStep: step }),
      dismissOnboarding: () => set({ status: 'dismissed' }),
      completeOnboarding: () => set({ status: 'completed', currentStep: 0 }),
      resetOnboarding: () => set({ status: 'new', currentStep: 0 }),
    }),
    {
      name: 'swing-screener-onboarding',
    }
  )
);
