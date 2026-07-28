import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as screenerApi from './screenerApi';
import * as watchlistApi from './watchlistApi';
import * as aiApi from './aiApi';
import * as portfolioApi from './portfolioApi';
import * as marketDataApi from './marketDataApi';

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('screenerApi', () => {
  it('runScreener posts taxonomy filter', async () => {
    const data = {
      candidates: [{ rank: 1, symbol: 'AAPL', exchange_mic: 'XNAS', setup: 'Momentum', entry: 180, stop: 170, rr: 2.5, risk_usd: 500, shares: 50, sector: 'Tech', price: 182, close: 181, catalyst: 'Earnings' }],
      universe: 'SP500', generated_at: '2025-01-15T20:00:00Z', freshness: 'final_close',
    };
    globalThis.fetch = mockFetch(200, data);

    const result = await screenerApi.runScreener({ region: 'us' });
    expect(result.universe).toBe('SP500');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].symbol).toBe('AAPL');
  });

  it('getScreenerJob returns screener result', async () => {
    const data = { candidates: [], universe: 'SP500', generated_at: '2025-01-15T20:00:00Z', freshness: 'final_close' };
    globalThis.fetch = mockFetch(200, data);

    const result = await screenerApi.getScreenerJob('job-1');
    expect(result.freshness).toBe('final_close');
  });

  it('getPoolPresets returns presets', async () => {
    const data = { presets: [{ id: 'us-mega', label: 'US Mega Cap', filter: { region: 'us', market_cap_tier: 'mega' } }] };
    globalThis.fetch = mockFetch(200, data);

    const result = await screenerApi.getPoolPresets();
    expect(result.presets).toHaveLength(1);
    expect(result.presets[0].id).toBe('us-mega');
  });

  it('getSymbolPool returns symbols', async () => {
    const data = { symbols: [{ symbol: 'AAPL', exchange_mic: 'XNAS', currency: 'USD' }], total: 1, page: 1, page_size: 50 };
    globalThis.fetch = mockFetch(200, data);

    const result = await screenerApi.getSymbolPool({ region: 'us' });
    expect(result.symbols).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('getReviewQueue returns entries', async () => {
    globalThis.fetch = mockFetch(200, { entries: [] });

    const result = await screenerApi.getReviewQueue();
    expect(result.entries).toEqual([]);
  });

  it('removeReviewQueueEntry posts remove', async () => {
    globalThis.fetch = mockFetch(200, { removed: true });

    const result = await screenerApi.removeReviewQueueEntry('AAPL');
    expect(result.removed).toBe(true);
  });

  it('restoreReviewQueueEntry posts restore', async () => {
    globalThis.fetch = mockFetch(200, { restored: true });

    const result = await screenerApi.restoreReviewQueueEntry('AAPL');
    expect(result.restored).toBe(true);
  });
});

describe('watchlistApi', () => {
  it('getWatchlist returns items', async () => {
    globalThis.fetch = mockFetch(200, [
      { symbol: 'AAPL', exchange_mic: 'XNAS', price: 182, change_pct: 1.2, sector: 'Tech', held: 10 },
    ]);

    const items = await watchlistApi.getWatchlist();
    expect(items).toHaveLength(1);
    expect(items[0].symbol).toBe('AAPL');
  });

  it('addWatchlistItem puts ticker', async () => {
    globalThis.fetch = mockFetch(200, {
      symbol: 'AAPL', exchange_mic: 'XNAS', price: 182, change_pct: 1.2,
      setup: 'Breakout', rr: 2.5, sector: 'Tech', held: 10,
    });

    const item = await watchlistApi.addWatchlistItem('AAPL');
    expect(item.symbol).toBe('AAPL');
    expect(item.setup).toBe('Breakout');
  });

  it('removeWatchlistItem deletes ticker', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 204, json: () => Promise.resolve(),
    });

    await expect(watchlistApi.removeWatchlistItem('AAPL')).resolves.toBeUndefined();
  });
});

describe('aiApi', () => {
  it('analyzeTicker posts to intelligence endpoint', async () => {
    globalThis.fetch = mockFetch(200, {
      ticker: 'AAPL', generated_at: '2025-01-15T20:00:00Z', thesis: 'Strong momentum',
      entry: 180, stop: 170, target: 200, rr: 2.5,
    });

    const result = await aiApi.analyzeTicker('AAPL');
    expect(result.ticker).toBe('AAPL');
    expect(result.thesis).toBe('Strong momentum');
  });

  it('getAIHistory returns entries', async () => {
    globalThis.fetch = mockFetch(200, {
      entries: [{ generated_at: '2025-01-14T20:00:00Z', action: 'WATCH', conviction: 'moderate', summary_line: 'Earnings play', watch_for: 'Break above 185' }],
    });

    const result = await aiApi.getAIHistory('AAPL');
    expect(result.entries).toHaveLength(1);
  });

  it('getAILatest returns analysis', async () => {
    globalThis.fetch = mockFetch(200, {
      ticker: 'AAPL', generated_at: '2025-01-15T20:00:00Z', thesis: 'Strong momentum',
      entry: 180, stop: 170, target: 200, rr: 2.5,
    });

    const result = await aiApi.getAILatest('AAPL');
    expect(result.ticker).toBe('AAPL');
  });

  it('postChat sends message', async () => {
    globalThis.fetch = mockFetch(200, { role: 'assistant', content: 'Based on the analysis...' });

    const result = await aiApi.postChat('AAPL', 'What catalysts?');
    expect(result).toBeDefined();
  });

  it('requestPositionReview posts for position', async () => {
    globalThis.fetch = mockFetch(200, { status: 'reviewed', guidance: 'Hold with current stop' });

    const result = await aiApi.requestPositionReview('pos-1');
    expect(result).toBeDefined();
  });
});

describe('portfolioApi', () => {
  it('getPositions returns positions', async () => {
    globalThis.fetch = mockFetch(200, [{
      position_id: 'pos-1', ticker: 'AAPL', direction: 'long', entry_price: 175,
      current_price: 182, shares: 50, market_value: 9100, unrealized_pl: 350,
      rr_to_target: 1.5, distance_to_stop: 5, trail_method: 'fixed',
      target_price: 200,
    }]);

    const positions = await portfolioApi.getPositions();
    expect(positions).toHaveLength(1);
    expect(positions[0].ticker).toBe('AAPL');
  });

  it('getPositionMetrics returns metrics', async () => {
    globalThis.fetch = mockFetch(200, { profit_factor: 2.1, win_rate: 0.65 });

    const metrics = await portfolioApi.getPositionMetrics('pos-1');
    expect(metrics.profit_factor).toBe(2.1);
  });

  it('getStopSuggestion returns suggestion', async () => {
    globalThis.fetch = mockFetch(200, { suggested_stop: 170, reason: 'Support level' });

    const suggestion = await portfolioApi.getStopSuggestion('pos-1');
    expect(suggestion.suggested_stop).toBe(170);
  });

  it('getStopPreview returns preview', async () => {
    globalThis.fetch = mockFetch(200, { new_distance: 7, new_risk: 350 });

    const preview = await portfolioApi.getStopPreview('pos-1', 170);
    expect(preview.new_distance).toBe(7);
  });

  it('updateStop puts stop price', async () => {
    globalThis.fetch = mockFetch(200, {
      position_id: 'pos-1', ticker: 'AAPL', direction: 'long', entry_price: 175,
      current_price: 182, shares: 50, market_value: 9100, unrealized_pl: 350,
      rr_to_target: 1.5, distance_to_stop: 7, trail_method: 'fixed',
      target_price: 200,
    });

    const position = await portfolioApi.updateStop('pos-1', 170);
    expect(position.position_id).toBe('pos-1');
  });

  it('getDailyReview returns review', async () => {
    globalThis.fetch = mockFetch(200, {
      kpis: [{ label: 'Day P&L', value: '+$350', detail: '0.5%' }],
      positions: [], candidates: [], alerts: [],
      steps: [{ name: 'Fetch data', status: 'done' }],
    });

    const review = await portfolioApi.getDailyReview();
    expect(review.kpis).toHaveLength(1);
    expect(review.steps[0].status).toBe('done');
  });
});

describe('marketDataApi', () => {
  it('getCandles returns price history and patterns', async () => {
    globalThis.fetch = mockFetch(200, {
      price_history: [{ date: '2025-01-15', close: 182 }],
      patterns: [],
    });

    const result = await marketDataApi.getCandles('AAPL');
    expect(result.price_history).toHaveLength(1);
    expect(result.patterns).toEqual([]);
  });

  it('getVolumeAnalysis returns analysis', async () => {
    globalThis.fetch = mockFetch(200, { volume_zones: [{ price: 180, volume: 50000 }] });

    const result = await marketDataApi.getVolumeAnalysis('AAPL');
    expect(result.volume_zones).toBeDefined();
  });
});
