import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type OnboardingStatus = 'new' | 'dismissed' | 'completed';
export type ExecutionSetup = 'manual' | 'degiro';

interface OnboardingStore {
  status: OnboardingStatus;
  currentStep: number;
  executionSetup: ExecutionSetup;
  setStatus: (status: OnboardingStatus) => void;
  setCurrentStep: (step: number) => void;
  setExecutionSetup: (setup: ExecutionSetup) => void;
  dismissOnboarding: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set) => ({
      status: 'new',
      currentStep: 0,
      executionSetup: 'manual',
      setStatus: (status) => set({ status }),
      setCurrentStep: (step) => set({ currentStep: step }),
      setExecutionSetup: (executionSetup) => set({ executionSetup }),
      dismissOnboarding: () => set({ status: 'dismissed' }),
      completeOnboarding: () => set({ status: 'completed', currentStep: 0 }),
      resetOnboarding: () => set({ status: 'new', currentStep: 0, executionSetup: 'manual' }),
    }),
    {
      name: 'swing-screener-onboarding',
    }
  )
);
