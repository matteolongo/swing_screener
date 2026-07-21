import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiUrl } from './api';
import { apiFetch, setCsrfToken, subscribeAuthExpired } from './apiFetch';

afterEach(() => {
  setCsrfToken(null);
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('resolves API URLs and always includes cookie credentials', async () => {
    const spy = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })));
    vi.stubGlobal('fetch', spy);

    await apiFetch('/api/data', { credentials: 'omit' });

    expect(spy).toHaveBeenCalledWith(apiUrl('/api/data'), expect.objectContaining({ credentials: 'include' }));
  });

  it('adds CSRF only to unsafe methods and preserves caller headers', async () => {
    const spy = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })));
    vi.stubGlobal('fetch', spy);
    setCsrfToken('csrf-value');

    await apiFetch('/api/read', { headers: { Accept: 'application/json' } });
    await apiFetch('/api/write', { method: 'POST', headers: { 'Content-Type': 'application/json' } });

    const calls = spy.mock.calls as unknown as Array<[string, RequestInit]>;
    const readHeaders = new Headers(calls[0][1]?.headers);
    const writeHeaders = new Headers(calls[1][1]?.headers);
    expect(readHeaders.get('X-CSRF-Token')).toBeNull();
    expect(readHeaders.get('Accept')).toBe('application/json');
    expect(writeHeaders.get('X-CSRF-Token')).toBe('csrf-value');
    expect(writeHeaders.get('Content-Type')).toBe('application/json');
  });

  it('emits one expiry event for a burst of unauthorized responses', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 401 }))));
    const listener = vi.fn();
    const unsubscribe = subscribeAuthExpired(listener);

    await Promise.all([apiFetch('/api/a'), apiFetch('/api/b'), apiFetch('/api/c')]);

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
