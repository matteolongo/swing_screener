import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBeginnerModeStore } from './beginnerModeStore';

describe('useBeginnerModeStore', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    // Reset store state after each test
    const { result } = renderHook(() => useBeginnerModeStore());
    act(() => {
      result.current.setBeginnerMode(true);
    });
  });

  it('should initialize with beginner mode enabled by default', () => {
    const { result } = renderHook(() => useBeginnerModeStore());
    
    expect(result.current.isBeginnerMode).toBe(true);
  });

  it('should set beginner mode to false', () => {
    const { result } = renderHook(() => useBeginnerModeStore());
    
    act(() => {
      result.current.setBeginnerMode(false);
    });
    
    expect(result.current.isBeginnerMode).toBe(false);
  });

  it('should toggle beginner mode', () => {
    const { result } = renderHook(() => useBeginnerModeStore());
    
    const initialValue = result.current.isBeginnerMode;
    
    act(() => {
      result.current.toggleBeginnerMode();
    });
    
    expect(result.current.isBeginnerMode).toBe(!initialValue);
    
    act(() => {
      result.current.toggleBeginnerMode();
    });
    
    expect(result.current.isBeginnerMode).toBe(initialValue);
  });

  it('should persist beginner mode state in localStorage', () => {
    const { result } = renderHook(() => useBeginnerModeStore());
    
    act(() => {
      result.current.setBeginnerMode(false);
    });
    
    // Check that state was written to localStorage
    const stored = localStorage.getItem('swing-screener-beginner-mode');
    expect(stored).toBeTruthy();
    
    if (stored) {
      const parsed = JSON.parse(stored);
      expect(parsed.state.isBeginnerMode).toBe(false);
    }
  });

  it('should store beginner mode as true in localStorage', () => {
    const { result } = renderHook(() => useBeginnerModeStore());
    
    act(() => {
      result.current.setBeginnerMode(true);
    });
    
    // Check that state was written to localStorage
    const stored = localStorage.getItem('swing-screener-beginner-mode');
    expect(stored).toBeTruthy();
    
    if (stored) {
      const parsed = JSON.parse(stored);
      expect(parsed.state.isBeginnerMode).toBe(true);
    }
  });
});
