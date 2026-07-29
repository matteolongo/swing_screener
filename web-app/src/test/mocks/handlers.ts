import { http, HttpResponse } from 'msw';

const BASE = 'http://localhost:8000';

export const handlers = [
  http.post(`${BASE}/api/screener/run`, () =>
    HttpResponse.json({
      candidates: [
        { rank: 1, symbol: 'AAPL', exchange_mic: 'XNAS', setup: 'Momentum', entry: 180, stop: 170, rr: 2.5, risk_usd: 500, shares: 50, sector: 'Tech', price: 182, close: 181, catalyst: 'Earnings' },
        { rank: 2, symbol: 'MSFT', exchange_mic: 'XNAS', setup: 'Breakout', entry: 380, stop: 370, rr: 2.0, risk_usd: 400, shares: 10, sector: 'Tech', price: 385, close: 383 },
      ],
      universe: 'SP500',
      generated_at: '2025-01-15T20:00:00Z',
      freshness: 'final_close',
    }),
  ),

  http.get(`${BASE}/api/watchlist`, () =>
    HttpResponse.json([
      { symbol: 'AAPL', exchange_mic: 'XNAS', price: 182, change_pct: 1.2, setup: 'Breakout', rr: 2.5, sector: 'Tech', held: 10 },
      { symbol: 'MSFT', exchange_mic: 'XNAS', price: 385, change_pct: 0.8, sector: 'Tech' },
    ]),
  ),

  http.put(`${BASE}/api/watchlist/:ticker`, ({ params }) =>
    HttpResponse.json({
      symbol: params.ticker, exchange_mic: 'XNAS', price: 180, change_pct: 0, sector: 'Tech',
    }),
  ),

  http.delete(`${BASE}/api/watchlist/:ticker`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  http.post(`${BASE}/api/intelligence/:symbol`, ({ params }) =>
    HttpResponse.json({
      ticker: params.symbol, generated_at: '2025-01-15T20:00:00Z', thesis: 'Strong momentum',
      entry: 180, stop: 170, target: 200, rr: 2.5,
    }),
  ),

  http.get(`${BASE}/api/intelligence/:symbol/history`, () =>
    HttpResponse.json({
      entries: [
        { generated_at: '2025-01-14T20:00:00Z', action: 'WATCH', conviction: 'moderate', summary_line: 'Earnings play', watch_for: 'Break above 185' },
      ],
    }),
  ),

  http.get(`${BASE}/api/intelligence/:symbol/latest`, ({ params }) =>
    HttpResponse.json({
      ticker: params.symbol, generated_at: '2025-01-15T20:00:00Z', thesis: 'Strong momentum',
      entry: 180, stop: 170, target: 200, rr: 2.5,
    }),
  ),

  http.post(`${BASE}/api/intelligence/:symbol/chat`, () =>
    HttpResponse.json({ response: 'Based on the analysis, the stock shows strength.', evidence_used: ['price_action', 'volume'] }),
  ),

  http.post(`${BASE}/api/intelligence/position-review/:id`, () =>
    HttpResponse.json({
      move_explanation: 'Stock moved on strong earnings',
      thesis_status: 'confirmed',
      profit_protection_guidance: 'Consider trailing stop',
      stop_advice: 'Maintain current stop',
      stop_price: 175,
      macro_overlay: 'Market is bullish',
    }),
  ),

  http.get(`${BASE}/api/pool/symbols`, () =>
    HttpResponse.json({
      symbols: [{ symbol: 'AAPL', exchange_mic: 'XNAS', currency: 'USD', sector: 'Tech' }],
      total: 1, page: 1, page_size: 50,
    }),
  ),

  http.get(`${BASE}/api/daily-review`, () =>
    HttpResponse.json({
      kpis: [{ label: 'Day P&L', value: '+$350', detail: '0.5%' }],
      positions: [],
      candidates: [],
      alerts: [],
      steps: [{ name: 'Fetch data', status: 'done' }],
    }),
  ),

  http.get(`${BASE}/api/portfolio/positions`, () =>
    HttpResponse.json([
      { position_id: 'pos-1', ticker: 'AAPL', direction: 'long', entry_price: 175, current_price: 182, shares: 50, market_value: 9100, unrealized_pl: 350, rr_to_target: 1.5, distance_to_stop: 5, trail_method: 'fixed', target_price: 200 },
    ]),
  ),
];
