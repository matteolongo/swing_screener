import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useUserPreferencesStore } from './userPreferencesStore';

describe('useUserPreferencesStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useUserPreferencesStore());
    act(() => {
      result.current.resetOnboarding();
    });
  });

  describe('initial state', () => {
    it('should have default values for new users', () => {
      const { result } = renderHook(() => useUserPreferencesStore());
      
      expect(result.current.onboardingCompleted).toBe(false);
      expect(result.current.onboardingStep).toBe(0);
      expect(result.current.onboardingDismissed).toBe(false);
      expect(result.current.isBeginnerMode).toBe(true);
    });
  });

  describe('onboarding progression', () => {
    it('should update onboarding step', () => {
      const { result } = renderHook(() => useUserPreferencesStore());
      
      act(() => {
        result.current.setOnboardingStep(2);
      });
      
      expect(result.current.onboardingStep).toBe(2);
      expect(result.current.onboardingCompleted).toBe(false);
    });

    it('should mark onboarding as completed', () => {
      const { result } = renderHook(() => useUserPreferencesStore());
      
      act(() => {
        result.current.completeOnboarding();
      });
      
      expect(result.current.onboardingCompleted).toBe(true);
      expect(result.current.onboardingStep).toBe(4);
    });

    it('should allow dismissing onboarding', () => {
      const { result } = renderHook(() => useUserPreferencesStore());
      
      act(() => {
        result.current.dismissOnboarding();
      });
      
      expect(result.current.onboardingDismissed).toBe(true);
      expect(result.current.onboardingCompleted).toBe(false);
    });
  });

  describe('resetting onboarding', () => {
    it('should reset all onboarding state', () => {
      const { result } = renderHook(() => useUserPreferencesStore());
      
      // Set some state
      act(() => {
        result.current.completeOnboarding();
        result.current.dismissOnboarding();
      });
      
      // Reset
      act(() => {
        result.current.resetOnboarding();
      });
      
      expect(result.current.onboardingCompleted).toBe(false);
      expect(result.current.onboardingStep).toBe(0);
      expect(result.current.onboardingDismissed).toBe(false);
    });
  });

  describe('beginner mode', () => {
    it('should start in beginner mode', () => {
      const { result } = renderHook(() => useUserPreferencesStore());
      
      expect(result.current.isBeginnerMode).toBe(true);
    });

    it('should toggle beginner mode', () => {
      const { result } = renderHook(() => useUserPreferencesStore());
      
      act(() => {
        result.current.setBeginnerMode(false);
      });
      
      expect(result.current.isBeginnerMode).toBe(false);
      
      act(() => {
        result.current.setBeginnerMode(true);
      });
      
      expect(result.current.isBeginnerMode).toBe(true);
    });
  });
});
