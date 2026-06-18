import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchJson } from './fetchJson';

function mockFetch(impl: () => Response | Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchJson', () => {
  it('returns parsed JSON on a 2xx response', async () => {
    mockFetch(() => new Response(JSON.stringify({ id: 'x', n: 1 }), { status: 200 }));
    const data = await fetchJson<{ id: string; n: number }>('/api/thing');
    expect(data).toEqual({ id: 'x', n: 1 });
  });

  it('returns undefined for an empty (204) body', async () => {
    mockFetch(() => new Response('', { status: 204 }));
    const data = await fetchJson<void>('/api/thing', { method: 'DELETE' });
    expect(data).toBeUndefined();
  });

  it('throws the response detail message on error', async () => {
    mockFetch(() => new Response(JSON.stringify({ detail: 'Symbol not found' }), { status: 404 }));
    await expect(fetchJson('/api/thing')).rejects.toThrow('Symbol not found');
  });

  it('falls back to the provided errorMessage when there is no detail', async () => {
    mockFetch(() => new Response(JSON.stringify({}), { status: 500 }));
    await expect(fetchJson('/api/thing', { errorMessage: 'Failed to load thing' })).rejects.toThrow(
      'Failed to load thing',
    );
  });

  it('falls back to a status message when body is not JSON and no errorMessage given', async () => {
    mockFetch(() => new Response('boom', { status: 503 }));
    await expect(fetchJson('/api/thing')).rejects.toThrow(/503/);
  });

  it('passes method/headers/body through to fetch', async () => {
    const spy = vi.fn(() => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', spy);
    await fetchJson('/api/thing', { method: 'POST', body: JSON.stringify({ a: 1 }) });
    expect(spy).toHaveBeenCalledTimes(1);
    const call = spy.mock.calls[0] as unknown as [string, Record<string, unknown>];
    const init = call[1];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect(init.errorMessage).toBeUndefined();
  });
});
