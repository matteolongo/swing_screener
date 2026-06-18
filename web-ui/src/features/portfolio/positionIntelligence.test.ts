import { describe, it, expect, vi } from 'vitest';
import { fetchOpenPositionsIntelligence, triggerPositionAnalyze } from './api';

describe('position intelligence API', () => {
  it('fetchOpenPositionsIntelligence calls the right endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
      text: async () => JSON.stringify([]),
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchOpenPositionsIntelligence();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/portfolio/positions/open/intelligence'),
      expect.anything(),
    );
    vi.unstubAllGlobals();
  });

  it('triggerPositionAnalyze calls POST endpoint with position id', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ symbol: 'BESI.AS', summary_line: 'Hold.' }),
      text: async () => JSON.stringify({ symbol: 'BESI.AS', summary_line: 'Hold.' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await triggerPositionAnalyze('pos-1');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/intelligence/position/pos-1'),
      expect.objectContaining({ method: 'POST' }),
    );
    vi.unstubAllGlobals();
  });
});
