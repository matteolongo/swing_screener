import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateStrategy } from './api';
import type { StrategyUpdateRequestAPI } from './types';

describe('validateStrategy', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('uses the backend validator', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      is_valid: true, warnings: [], safety_score: 100, safety_level: 'beginner-safe',
      total_warnings: 0, danger_count: 0, warning_count: 0, info_count: 0,
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(validateStrategy({} as StrategyUpdateRequestAPI)).resolves.toMatchObject({ isValid: true });
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/strategy/validate');
  });
});
