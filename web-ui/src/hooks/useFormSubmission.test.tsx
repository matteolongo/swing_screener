import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { UseMutationResult } from '@tanstack/react-query';
import { useFormSubmission } from './useFormSubmission';

function mockMutation(overrides: Partial<UseMutationResult<unknown, unknown, unknown>> = {}) {
  return {
    mutateAsync: vi.fn().mockResolvedValue('ok'),
    error: null,
    isPending: false,
    isSuccess: false,
    reset: vi.fn(),
    ...overrides,
  } as unknown as UseMutationResult<unknown, unknown, unknown>;
}

describe('useFormSubmission', () => {
  it('calls onSuccess with the mutation result', async () => {
    const onSuccess = vi.fn();
    const mutation = mockMutation();
    const { result } = renderHook(() => useFormSubmission(mutation, onSuccess));

    await act(async () => {
      await result.current.handleSubmit({ field: 1 });
    });

    expect(mutation.mutateAsync).toHaveBeenCalledWith({ field: 1 });
    expect(onSuccess).toHaveBeenCalledWith('ok');
  });

  it('rethrows on failure and leaves error surfacing to the mutation', async () => {
    const mutation = mockMutation({ mutateAsync: vi.fn().mockRejectedValue(new Error('boom')) });
    const { result } = renderHook(() => useFormSubmission(mutation));

    await expect(result.current.handleSubmit(undefined)).rejects.toThrow('boom');
  });

  it('exposes the mutation pending state as isSubmitting', () => {
    const { result } = renderHook(() => useFormSubmission(mockMutation({ isPending: true })));
    expect(result.current.isSubmitting).toBe(true);
  });

  it('formats error from message, detail, string, and fallback', () => {
    expect(renderHook(() => useFormSubmission(mockMutation({ error: null }))).result.current.error).toBeNull();

    expect(
      renderHook(() => useFormSubmission(mockMutation({ error: new Error('msg') }))).result.current.error
    ).toBe('msg');

    expect(
      renderHook(() => useFormSubmission(mockMutation({ error: { detail: 'detail-text' } as never })))
        .result.current.error
    ).toBe('detail-text');

    expect(
      renderHook(() => useFormSubmission(mockMutation({ error: 'string-error' as never }))).result.current.error
    ).toBe('string-error');

    expect(
      renderHook(() => useFormSubmission(mockMutation({ error: {} as never }))).result.current.error
    ).toBe('An error occurred during submission');
  });
});
