import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useModal } from './useModal';

describe('useModal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts closed with no data', () => {
    const { result } = renderHook(() => useModal<string>());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it('opens with a payload', () => {
    const { result } = renderHook(() => useModal<string>());

    act(() => result.current.open('payload'));

    expect(result.current.isOpen).toBe(true);
    expect(result.current.data).toBe('payload');
  });

  it('closes and clears data after the animation delay', () => {
    const { result } = renderHook(() => useModal<string>());

    act(() => result.current.open('payload'));
    act(() => result.current.close());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.data).toBe('payload'); // still present during animation

    act(() => vi.advanceTimersByTime(200));
    expect(result.current.data).toBeNull();
  });

  it('toggles open and closed', () => {
    const { result } = renderHook(() => useModal());

    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(false);
  });
});
