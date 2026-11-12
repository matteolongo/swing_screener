import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_ENDPOINTS } from '@/lib/api';
import { fetchJson } from '@/lib/fetchJson';
import { getDailyReview } from './api';

vi.mock('@/lib/fetchJson', () => ({ fetchJson: vi.fn() }));

describe('getDailyReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('requests a portfolio-only review from persisted state', async () => {
    await expect(getDailyReview().then((review) => review.watchlistNearTrigger)).resolves.toEqual([
      expect.objectContaining({ ticker: 'NEAR', distanceToTriggerPct: -1 }),
    ]);
    expect(fetchJson).toHaveBeenCalledWith(`${API_ENDPOINTS.dailyReview}?top_n=200&include_candidates=false`, expect.any(Object));
  });

});
