import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fillOrder } from '@/features/portfolio/api';

describe('portfolio api', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_PERSISTENCE_MODE', 'api');
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('surfaces backend detail when fill order fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: 'REP.MC: open position already exists.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(
      fillOrder('ORD-REP-1', {
        filledPrice: 21.8,
        filledDate: '2026-03-11',
        stopPrice: 20.33,
      }),
    ).rejects.toThrow('REP.MC: open position already exists.');
  });
});
