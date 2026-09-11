import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_ENDPOINTS } from '@/lib/api';
import { fetchJson } from '@/lib/fetchJson';
import { getActiveStrategyLocal, getAllOrdersLocal, getAllPositionsLocal, isLocalPersistenceMode, listWatchlistLocal } from '@/features/persistence';
import defaultStrategy from '@/features/persistence/defaultStrategyFixture.json';
import { transformStrategy, type StrategyAPI } from '@/features/strategy/types';
import { getWatchlistNearTrigger } from './api';

vi.mock('@/lib/fetchJson', () => ({ fetchJson: vi.fn() }));
vi.mock('@/features/persistence', () => ({
  getActiveStrategyLocal: vi.fn(),
  getAllOrdersLocal: vi.fn(),
  getAllPositionsLocal: vi.fn(),
  listWatchlistLocal: vi.fn(),
  isLocalPersistenceMode: vi.fn(),
}));

describe('getWatchlistNearTrigger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isLocalPersistenceMode).mockReturnValue(true);
    vi.mocked(getActiveStrategyLocal).mockReturnValue(transformStrategy(defaultStrategy as StrategyAPI));
    vi.mocked(getAllOrdersLocal).mockReturnValue([]);
    vi.mocked(getAllPositionsLocal).mockReturnValue([]);
    vi.mocked(listWatchlistLocal).mockReturnValue([{
      ticker: 'NEAR', watchedAt: '2026-09-11', watchPrice: 100, currency: 'USD', source: 'manual',
    }]);
    vi.mocked(fetchJson).mockResolvedValue({
      watchlist_near_trigger: [{
        ticker: 'NEAR',
        watched_at: '2026-09-11',
        source: 'manual',
        distance_to_trigger_pct: -1,
        price_history: [],
      }],
      new_candidates: [],
      positions_add_on_candidates: [],
      positions_hold: [],
      positions_update_stop: [],
      positions_close: [],
      summary: {
        total_positions: 0,
        no_action: 0,
        update_stop: 0,
        close_positions: 0,
        new_candidates: 0,
        add_on_candidates: 0,
        review_date: '2026-09-11',
      },
    });
  });

  it('computes the near-trigger slice from the local watchlist snapshot', async () => {
    await expect(getWatchlistNearTrigger()).resolves.toEqual([
      expect.objectContaining({ ticker: 'NEAR', distanceToTriggerPct: -1 }),
    ]);

    const [url, options] = vi.mocked(fetchJson).mock.calls[0];
    expect(url).toBe(API_ENDPOINTS.dailyReviewCompute);
    expect(options?.method).toBe('POST');
    expect(JSON.parse(options?.body as string)).toMatchObject({
      include_candidates: false,
      watchlist: [{ ticker: 'NEAR', watched_at: '2026-09-11', watch_price: 100, currency: 'USD', source: 'manual' }],
    });
  });

  it('uses persisted review state in API mode', async () => {
    vi.mocked(isLocalPersistenceMode).mockReturnValue(false);
    await expect(getWatchlistNearTrigger()).resolves.toEqual([
      expect.objectContaining({ ticker: 'NEAR', distanceToTriggerPct: -1 }),
    ]);
    expect(fetchJson).toHaveBeenCalledWith(`${API_ENDPOINTS.dailyReview}?top_n=1&include_candidates=false`, expect.any(Object));
    expect(listWatchlistLocal).not.toHaveBeenCalled();
  });
});
