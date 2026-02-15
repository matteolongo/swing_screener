import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnboardingStore, OnboardingStatus } from './onboardingStore';

describe('useOnboardingStore', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    // Reset store state after each test
    const { result } = renderHook(() => useOnboardingStore());
    act(() => {
      result.current.resetOnboarding();
    });
  });

  it('should initialize with new status and step 0', () => {
    const { result } = renderHook(() => useOnboardingStore());
    
    expect(result.current.status).toBe('new');
    expect(result.current.currentStep).toBe(0);
  });

  it('should set onboarding status', () => {
    const { result } = renderHook(() => useOnboardingStore());
    
    const statuses: OnboardingStatus[] = ['dismissed', 'completed', 'new'];
    
    statuses.forEach((status) => {
      act(() => {
        result.current.setStatus(status);
      });
      
      expect(result.current.status).toBe(status);
    });
  });

  it('should set current step', () => {
    const { result } = renderHook(() => useOnboardingStore());
    
    act(() => {
      result.current.setCurrentStep(2);
    });
    
    expect(result.current.currentStep).toBe(2);
  });

  it('should dismiss onboarding', () => {
    const { result } = renderHook(() => useOnboardingStore());
    
    act(() => {
      result.current.setCurrentStep(2);
      result.current.dismissOnboarding();
    });
    
    expect(result.current.status).toBe('dismissed');
    expect(result.current.currentStep).toBe(2); // Step is preserved
  });

  it('should complete onboarding and reset step', () => {
    const { result } = renderHook(() => useOnboardingStore());
    
    act(() => {
      result.current.setCurrentStep(3);
      result.current.completeOnboarding();
    });
    
    expect(result.current.status).toBe('completed');
    expect(result.current.currentStep).toBe(0);
  });

  it('should reset onboarding to initial state', () => {
    const { result } = renderHook(() => useOnboardingStore());
    
    act(() => {
      result.current.setStatus('completed');
      result.current.setCurrentStep(3);
      result.current.resetOnboarding();
    });
    
    expect(result.current.status).toBe('new');
    expect(result.current.currentStep).toBe(0);
  });

  it('should persist onboarding state in localStorage', () => {
    const { result } = renderHook(() => useOnboardingStore());
    
    act(() => {
      result.current.setStatus('dismissed');
      result.current.setCurrentStep(2);
    });
    
    // Check that state was written to localStorage
    const stored = localStorage.getItem('swing-screener-onboarding');
    expect(stored).toBeTruthy();
    
    if (stored) {
      const parsed = JSON.parse(stored);
      expect(parsed.state.status).toBe('dismissed');
      expect(parsed.state.currentStep).toBe(2);
    }
  });

  it('should persist completed onboarding state in localStorage', () => {
    const { result } = renderHook(() => useOnboardingStore());
    
    act(() => {
      result.current.completeOnboarding();
    });
    
    // Check that state was written to localStorage
    const stored = localStorage.getItem('swing-screener-onboarding');
    expect(stored).toBeTruthy();
    
    if (stored) {
      const parsed = JSON.parse(stored);
      expect(parsed.state.status).toBe('completed');
      expect(parsed.state.currentStep).toBe(0);
    }
  });
});
