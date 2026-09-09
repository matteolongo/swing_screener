import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { cancelOrder, closePosition, createOrder, fillOrder, partialClosePosition, submitOrder, updatePositionStop } from '@/features/portfolio/api';
import { getAllPositionsLocal, mutateTradingStore, readTradingStore, resetTradingStore, TRADING_STORE_STORAGE_KEY } from '@/features/persistence';
import { tradingSnapshotLocal } from './portfolioService';

const position = {
  ticker: 'AAPL', status: 'open' as const, entryDate: '2026-09-08', entryPrice: 100,
  stopPrice: 95, shares: 10, positionId: 'POS-1', currentPrice: 110,
  sourceOrderId: null, initialRisk: null, maxFavorablePrice: null, exitDate: null,
  exitPrice: null, notes: '', exitOrderIds: null,
  entryFeeEur: 2, entryFxRate: 1.1, partialCloses: [{ date: '2026-09-08', sharesClosed: 2, price: 108, rAtClose: 1.6, feeEur: 1, fxRate: 1.2 }],
};

function completePositionResponse(apiPosition: any) {
  return {
    ...apiPosition,
    position_id: 'POS-1',
    source_order_id: null,
    initial_risk: null,
    max_favorable_price: null,
    exit_date: null,
    exit_price: null,
    current_price: null,
    notes: '',
    exit_order_ids: null,
  };
}

function withoutField(value: Record<string, unknown>, field: string) {
  const copy = { ...value };
  delete copy[field];
  return copy;
}

describe('local trading command transport', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { locks: { request: async (_name: string, action: () => Promise<void>) => action() } });
    vi.stubEnv('VITE_PERSISTENCE_MODE', 'local');
    vi.stubEnv('VITE_ENABLE_LOCAL_PERSISTENCE', 'true');
    resetTradingStore();
    mutateTradingStore(store => { store.positions = [position as any]; });
  });

  it.each([
    ['create_order', () => createOrder({ ticker: 'MSFT', orderType: 'BUY_LIMIT', quantity: 2, limitPrice: 100, stopPrice: 95, approvalToken: 'signed' }, 'create-key'), { ticker: 'MSFT', approval_token: 'signed' }],
    ['fill_order', () => fillOrder('ORD-1', { filledPrice: 101, filledDate: '2026-09-09', feeEur: 2.9, fillFxRate: 1.12 }, 'fill-key'), { order_id: 'ORD-1', fee_eur: 2.9, fill_fx_rate: 1.12 }],
    ['submit_order', () => submitOrder('ORD-1'), { order_id: 'ORD-1' }],
    ['cancel_order', () => cancelOrder('ORD-1'), { order_id: 'ORD-1' }],
    ['close_position', () => closePosition('POS-1', { exitPrice: 110, feeEur: 3, exitFxRate: 1.12, lesson: 'review', tags: ['target'] }, 'close-key'), { position_id: 'POS-1', exit_price: 110, exit_fx_rate: 1.12, lesson: 'review' }],
    ['partial_close', () => partialClosePosition('POS-1', { sharesClosed: 2, price: 110, feeEur: 1, fxRate: 1.12 }, 'partial-key'), { position_id: 'POS-1', shares_closed: 2, fx_rate: 1.12 }],
  ] as const)('persists only the returned snapshot for %s', async (operation, perform, expectedPayload) => {
    let sent: any;
    server.use(http.post('*/api/portfolio/state/commands', async ({ request }) => {
      sent = await request.json();
      expect(readTradingStore().positions[0].shares).toBe(10);
      return HttpResponse.json({ ...sent.snapshot, revision: 1, positions: [{ ...sent.snapshot.positions[0], shares: 7, initial_risk: 4.25 }], orders: [], affected_order_ids: [], affected_position_ids: ['POS-1'] });
    }));
    await perform();
    expect(sent.command).toMatchObject({ operation, payload: expectedPayload });
    expect(sent.expected_revision).toBe(0);
    expect(sent.context.effective_at).toMatch(/T.*Z$/);
    if (operation === 'fill_order') expect(sent.context.new_position_id).toBeTruthy();
    expect(sent.snapshot.positions[0]).toMatchObject({ entry_fee_eur: 2, entry_fx_rate: 1.1, partial_closes: [{ shares_closed: 2, r_at_close: 1.6, fx_rate: 1.2 }] });
    expect(getAllPositionsLocal()[0]).toMatchObject({ shares: 7, initialRisk: 4.25 });
    expect((readTradingStore() as any).revision).toBe(1);
  });

  it.each([409, 422, 500])('leaves browser state unchanged on HTTP %s', async status => {
    const before = localStorage.getItem(TRADING_STORE_STORAGE_KEY);
    server.use(http.post('*/api/portfolio/state/commands', () => HttpResponse.json({ detail: 'rejected' }, { status })));
    await expect(closePosition('POS-1', { exitPrice: 110 }, `failure-${status}`)).rejects.toThrow('rejected');
    expect(localStorage.getItem(TRADING_STORE_STORAGE_KEY)).toBe(before);
  });

  it('rejects a stale response without overwriting intervening browser changes', async () => {
    server.use(http.post('*/api/portfolio/state/commands', async ({ request }) => {
      const sent = await request.json() as any;
      mutateTradingStore(store => { store.positions[0].notes = 'newer edit'; });
      return HttpResponse.json({ ...sent.snapshot, revision: 1 });
    }));
    await expect(closePosition('POS-1', { exitPrice: 110 }, 'stale')).rejects.toThrow(/changed|conflict/i);
    expect(getAllPositionsLocal()[0].notes).toBe('newer edit');
  });

  it('deduplicates a successful command and rejects key reuse with changed input', async () => {
    let calls = 0;
    server.use(http.post('*/api/portfolio/state/commands', async ({ request }) => {
      calls += 1;
      const sent = await request.json() as any;
      return HttpResponse.json({ ...sent.snapshot, revision: sent.snapshot.revision + 1 });
    }));
    await closePosition('POS-1', { exitPrice: 110 }, 'same-key');
    await closePosition('POS-1', { exitPrice: 110 }, 'same-key');
    expect(calls).toBe(1);
    await expect(closePosition('POS-1', { exitPrice: 111 }, 'same-key')).rejects.toThrow(/different|reused/i);
  });

  it('fails closed for stop updates without a timestamped price observation', async () => {
    await expect(updatePositionStop('POS-1', { newStop: 98 })).rejects.toThrow(/observation/i);
    expect(getAllPositionsLocal()[0].stopPrice).toBe(95);
  });

  it('transports the caller price observation without replacing its timestamp', async () => {
    let sent: any;
    server.use(http.post('*/api/portfolio/state/commands', async ({ request }) => {
      sent = await request.json();
      return HttpResponse.json({ ...sent.snapshot, revision: 1 });
    }));
    await updatePositionStop('POS-1', { newStop: 98, marketPrice: { ticker: 'AAPL', price: 110, observedAt: '2026-09-09T19:00:00Z', dataStatus: 'current' } } as any);
    expect(sent.context.market_price).toEqual({ ticker: 'AAPL', price: 110, observed_at: '2026-09-09T19:00:00Z', data_status: 'current' });
  });

  it('refuses a mutation when the browser cannot serialize commands across tabs', async () => {
    vi.stubGlobal('navigator', {});
    const before = localStorage.getItem(TRADING_STORE_STORAGE_KEY);
    server.use(http.post('*/api/portfolio/state/commands', async ({ request }) => {
      const sent = await request.json() as any;
      return HttpResponse.json({ ...sent.snapshot, revision: 1 });
    }));
    await expect(closePosition('POS-1', { exitPrice: 110 }, 'no-lock')).rejects.toThrow(/lock/i);
    expect(localStorage.getItem(TRADING_STORE_STORAGE_KEY)).toBe(before);
  });

  it('retries network failure with identical context and does not persist before success', async () => {
    const requests: any[] = [];
    const before = localStorage.getItem(TRADING_STORE_STORAGE_KEY);
    server.use(http.post('*/api/portfolio/state/commands', async ({ request }) => {
      const sent = await request.json() as any;
      requests.push(sent);
      return requests.length === 1 ? HttpResponse.error() : HttpResponse.json({ ...sent.snapshot, revision: 1 });
    }));
    await expect(fillOrder('ORD-1', { filledPrice: 101, filledDate: '2026-09-09' }, 'network-key')).rejects.toThrow();
    expect(localStorage.getItem(TRADING_STORE_STORAGE_KEY)).toBe(before);
    await fillOrder('ORD-1', { filledPrice: 101, filledDate: '2026-09-09' }, 'network-key');
    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual(requests[0]);
  });

  it('serializes overlapping mutations against successive revisions', async () => {
    const revisions: number[] = [];
    server.use(http.post('*/api/portfolio/state/commands', async ({ request }) => {
      const sent = await request.json() as any;
      revisions.push(sent.expected_revision);
      return HttpResponse.json({ ...sent.snapshot, revision: sent.snapshot.revision + 1 });
    }));
    await Promise.all([submitOrder('ORD-1'), cancelOrder('ORD-1')]);
    expect(revisions).toEqual([0, 1]);
    expect(readTradingStore().revision).toBe(2);
  });

  it.each([submitOrder, cancelOrder])('deduplicates repeated order status commands', async perform => {
    let calls = 0;
    server.use(http.post('*/api/portfolio/state/commands', async ({ request }) => {
      calls += 1;
      const sent = await request.json() as any;
      return HttpResponse.json({ ...sent.snapshot, revision: sent.snapshot.revision + 1 });
    }));
    await perform('ORD-1');
    await perform('ORD-1');
    expect(calls).toBe(1);
  });

  it('rejects an invalid successful response before replacing browser state', async () => {
    const before = localStorage.getItem(TRADING_STORE_STORAGE_KEY);
    server.use(http.post('*/api/portfolio/state/commands', () => HttpResponse.json({ revision: 99, orders: [], positions: [] })));
    await expect(closePosition('POS-1', { exitPrice: 110 }, 'malformed')).rejects.toThrow(/invalid/i);
    expect(localStorage.getItem(TRADING_STORE_STORAGE_KEY)).toBe(before);
  });

  it('rejects malformed order and position records before recording command success', async () => {
    const before = localStorage.getItem(TRADING_STORE_STORAGE_KEY);
    server.use(http.post('*/api/portfolio/state/commands', async ({ request }) => {
      const sent = await request.json() as any;
      return HttpResponse.json({ ...sent.snapshot, revision: sent.snapshot.revision + 1, orders: [{}], positions: [{}] });
    }));
    await expect(closePosition('POS-1', { exitPrice: 110 }, 'malformed-records')).rejects.toThrow(/invalid/i);
    expect(localStorage.getItem(TRADING_STORE_STORAGE_KEY)).toBe(before);
  });

  it('rejects malformed strategy contents before recording command success', async () => {
    const before = localStorage.getItem(TRADING_STORE_STORAGE_KEY);
    server.use(http.post('*/api/portfolio/state/commands', async ({ request }) => {
      const sent = await request.json() as any;
      return HttpResponse.json({ ...sent.snapshot, revision: sent.snapshot.revision + 1, strategy: { ...sent.snapshot.strategy, universe: {} } });
    }));
    await expect(closePosition('POS-1', { exitPrice: 110 }, 'malformed-strategy')).rejects.toThrow(/invalid/i);
    expect(localStorage.getItem(TRADING_STORE_STORAGE_KEY)).toBe(before);
  });

  it.each([
    ['an unknown order status', (snapshot: any) => ({
      orders: [{ order_id: 'ORD-1', ticker: 'AAPL', status: 'unexpected', order_type: 'BUY_LIMIT', quantity: 10, limit_price: 100, stop_price: 95, target_price: null, order_date: '2026-09-08', filled_date: '', entry_price: null, notes: '', order_kind: 'entry', parent_order_id: null, position_id: null, tif: null }],
      positions: snapshot.positions,
    })],
    ['an unknown position status', (snapshot: any) => ({
      orders: snapshot.orders,
      positions: [{ ...snapshot.positions[0], status: 'unexpected' }],
    })],
    ['an unknown non-null trail method', (snapshot: any) => ({
      orders: snapshot.orders,
      positions: [{ ...snapshot.positions[0], trail_method: 'unexpected' }],
    })],
    ['an invalid non-null order kind', (snapshot: any) => ({
      orders: [{ order_id: 'ORD-1', ticker: 'AAPL', status: 'pending', order_type: 'BUY_LIMIT', quantity: 10, limit_price: 100, stop_price: 95, target_price: null, order_date: '2026-09-08', filled_date: '', entry_price: null, notes: '', order_kind: 'unexpected', parent_order_id: null, position_id: null, tif: null }],
      positions: snapshot.positions,
    })],
  ])('rejects a successful response with %s before persistence', async (_description, buildResponse) => {
    const key = `invalid-enum-${crypto.randomUUID()}`;
    const before = localStorage.getItem(TRADING_STORE_STORAGE_KEY);
    server.use(http.post('*/api/portfolio/state/commands', async ({ request }) => {
      const sent = await request.json() as any;
      return HttpResponse.json({ ...sent.snapshot, revision: sent.snapshot.revision + 1, ...buildResponse(sent.snapshot) });
    }));
    await expect(closePosition('POS-1', { exitPrice: 110 }, key)).rejects.toThrow(/invalid/i);
    expect(localStorage.getItem(TRADING_STORE_STORAGE_KEY)).toBe(before);
    expect(readTradingStore().appliedCommands?.[key]).toBeUndefined();
  });

  it.each([
    ['an invalid risk account size mode', (strategy: any) => ({
      risk: { ...strategy.risk, account_size_mode: 'unexpected' },
    })],
    ['an invalid intelligence universe scope', (strategy: any) => ({
      market_intelligence: { ...strategy.market_intelligence, universe_scope: 'unexpected' },
    })],
    ['an invalid intelligence LLM provider', (strategy: any) => ({
      market_intelligence: { ...strategy.market_intelligence, llm: { ...strategy.market_intelligence.llm, provider: 'unexpected' } },
    })],
  ])('rejects a successful response with %s before persistence', async (_description, buildStrategy) => {
    const key = `invalid-strategy-enum-${crypto.randomUUID()}`;
    const before = localStorage.getItem(TRADING_STORE_STORAGE_KEY);
    server.use(http.post('*/api/portfolio/state/commands', async ({ request }) => {
      const sent = await request.json() as any;
      return HttpResponse.json({ ...sent.snapshot, revision: sent.snapshot.revision + 1, strategy: { ...sent.snapshot.strategy, ...buildStrategy(sent.snapshot.strategy) } });
    }));
    await expect(closePosition('POS-1', { exitPrice: 110 }, key)).rejects.toThrow(/invalid/i);
    expect(localStorage.getItem(TRADING_STORE_STORAGE_KEY)).toBe(before);
    expect(readTradingStore().appliedCommands?.[key]).toBeUndefined();
  });

  it.each([
    ['a non-boolean intelligence enabled value', (marketIntelligence: any) => ({ ...marketIntelligence, enabled: 'unexpected' })],
    ['a non-string intelligence provider entry', (marketIntelligence: any) => ({ ...marketIntelligence, providers: ['yahoo_finance', 1] })],
    ['a non-string intelligence market context entry', (marketIntelligence: any) => ({ ...marketIntelligence, market_context_symbols: ['SPY', 1] })],
    ['a non-boolean LLM enabled value', (marketIntelligence: any) => ({ ...marketIntelligence, llm: { ...marketIntelligence.llm, enabled: 'unexpected' } })],
    ['a non-string LLM model', (marketIntelligence: any) => ({ ...marketIntelligence, llm: { ...marketIntelligence.llm, model: 1 } })],
    ['a non-string LLM base URL', (marketIntelligence: any) => ({ ...marketIntelligence, llm: { ...marketIntelligence.llm, base_url: 1 } })],
    ['a non-boolean LLM cache flag', (marketIntelligence: any) => ({ ...marketIntelligence, llm: { ...marketIntelligence.llm, enable_cache: 'unexpected' } })],
    ['a non-boolean LLM audit flag', (marketIntelligence: any) => ({ ...marketIntelligence, llm: { ...marketIntelligence.llm, enable_audit: 'unexpected' } })],
    ['a non-string LLM cache path', (marketIntelligence: any) => ({ ...marketIntelligence, llm: { ...marketIntelligence.llm, cache_path: 1 } })],
    ['a non-string LLM audit path', (marketIntelligence: any) => ({ ...marketIntelligence, llm: { ...marketIntelligence.llm, audit_path: 1 } })],
    ['a non-numeric LLM concurrency', (marketIntelligence: any) => ({ ...marketIntelligence, llm: { ...marketIntelligence.llm, max_concurrency: 'unexpected' } })],
    ['a non-numeric catalyst lookback', (marketIntelligence: any) => ({ ...marketIntelligence, catalyst: { ...marketIntelligence.catalyst, lookback_hours: 'unexpected' } })],
    ['a non-numeric catalyst recency half-life', (marketIntelligence: any) => ({ ...marketIntelligence, catalyst: { ...marketIntelligence.catalyst, recency_half_life_hours: 'unexpected' } })],
    ['a non-numeric catalyst false-return threshold', (marketIntelligence: any) => ({ ...marketIntelligence, catalyst: { ...marketIntelligence.catalyst, false_catalyst_return_z: 'unexpected' } })],
    ['a non-numeric catalyst price-reaction threshold', (marketIntelligence: any) => ({ ...marketIntelligence, catalyst: { ...marketIntelligence.catalyst, min_price_reaction_atr: 'unexpected' } })],
    ['a non-boolean catalyst price-confirmation flag', (marketIntelligence: any) => ({ ...marketIntelligence, catalyst: { ...marketIntelligence.catalyst, require_price_confirmation: 'unexpected' } })],
    ['a non-boolean theme enabled value', (marketIntelligence: any) => ({ ...marketIntelligence, theme: { ...marketIntelligence.theme, enabled: 'unexpected' } })],
    ['a non-numeric theme cluster size', (marketIntelligence: any) => ({ ...marketIntelligence, theme: { ...marketIntelligence.theme, min_cluster_size: 'unexpected' } })],
    ['a non-numeric theme peer confirmation', (marketIntelligence: any) => ({ ...marketIntelligence, theme: { ...marketIntelligence.theme, min_peer_confirmation: 'unexpected' } })],
    ['a non-string theme peer-map path', (marketIntelligence: any) => ({ ...marketIntelligence, theme: { ...marketIntelligence.theme, curated_peer_map_path: 1 } })],
    ['a non-numeric opportunity technical weight', (marketIntelligence: any) => ({ ...marketIntelligence, opportunity: { ...marketIntelligence.opportunity, technical_weight: 'unexpected' } })],
    ['a non-numeric opportunity catalyst weight', (marketIntelligence: any) => ({ ...marketIntelligence, opportunity: { ...marketIntelligence.opportunity, catalyst_weight: 'unexpected' } })],
    ['a non-numeric opportunity maximum', (marketIntelligence: any) => ({ ...marketIntelligence, opportunity: { ...marketIntelligence.opportunity, max_daily_opportunities: 'unexpected' } })],
    ['a non-numeric opportunity minimum score', (marketIntelligence: any) => ({ ...marketIntelligence, opportunity: { ...marketIntelligence.opportunity, min_opportunity_score: 'unexpected' } })],
  ])('rejects a successful response with %s before persistence', async (_description, buildMarketIntelligence) => {
    const key = `invalid-strategy-field-${crypto.randomUUID()}`;
    const before = localStorage.getItem(TRADING_STORE_STORAGE_KEY);
    server.use(http.post('*/api/portfolio/state/commands', async ({ request }) => {
      const sent = await request.json() as any;
      const marketIntelligence = buildMarketIntelligence(sent.snapshot.strategy.market_intelligence ?? {});
      return HttpResponse.json({ ...sent.snapshot, revision: sent.snapshot.revision + 1, strategy: { ...sent.snapshot.strategy, market_intelligence: marketIntelligence } });
    }));
    await expect(closePosition('POS-1', { exitPrice: 110 }, key)).rejects.toThrow(/invalid/i);
    expect(localStorage.getItem(TRADING_STORE_STORAGE_KEY)).toBe(before);
    expect(readTradingStore().appliedCommands?.[key]).toBeUndefined();
  });

  it('accepts a valid null position identity', async () => {
    const key = 'nullable-position-id';
    server.use(http.post('*/api/portfolio/state/commands', async ({ request }) => {
      const sent = await request.json() as any;
      return HttpResponse.json({ ...sent.snapshot, revision: sent.snapshot.revision + 1, positions: [{ ...completePositionResponse(sent.snapshot.positions[0]), position_id: null }] });
    }));
    await closePosition('POS-1', { exitPrice: 110 }, key);
    expect(readTradingStore().revision).toBe(1);
    expect(readTradingStore().appliedCommands?.[key]).toBeDefined();
  });

  it.each([
    ['a missing notes value', (position: any) => withoutField(position, 'notes')],
    ['a non-string notes value', (position: any) => ({ ...position, notes: 1 })],
    ['a missing position identity', (position: any) => withoutField(position, 'position_id')],
    ['a non-string position identity', (position: any) => ({ ...position, position_id: 1 })],
    ['a missing source order identity', (position: any) => withoutField(position, 'source_order_id')],
    ['a non-string source order identity', (position: any) => ({ ...position, source_order_id: 1 })],
    ['a missing initial risk', (position: any) => withoutField(position, 'initial_risk')],
    ['a non-numeric initial risk', (position: any) => ({ ...position, initial_risk: 'unexpected' })],
    ['a missing maximum favorable price', (position: any) => withoutField(position, 'max_favorable_price')],
    ['a non-numeric maximum favorable price', (position: any) => ({ ...position, max_favorable_price: 'unexpected' })],
    ['a missing exit date', (position: any) => withoutField(position, 'exit_date')],
    ['a non-string exit date', (position: any) => ({ ...position, exit_date: 1 })],
    ['a missing exit price', (position: any) => withoutField(position, 'exit_price')],
    ['a non-numeric exit price', (position: any) => ({ ...position, exit_price: 'unexpected' })],
    ['a missing current price', (position: any) => withoutField(position, 'current_price')],
    ['a non-numeric current price', (position: any) => ({ ...position, current_price: 'unexpected' })],
    ['missing exit order identifiers', (position: any) => withoutField(position, 'exit_order_ids')],
    ['invalid exit order identifiers', (position: any) => ({ ...position, exit_order_ids: 'unexpected' })],
  ])('rejects a successful response with %s before persistence', async (_description, buildPosition) => {
    const key = `invalid-required-position-${crypto.randomUUID()}`;
    const before = localStorage.getItem(TRADING_STORE_STORAGE_KEY);
    server.use(http.post('*/api/portfolio/state/commands', async ({ request }) => {
      const sent = await request.json() as any;
      return HttpResponse.json({ ...sent.snapshot, revision: sent.snapshot.revision + 1, positions: [buildPosition(completePositionResponse(sent.snapshot.positions[0]))] });
    }));
    await expect(closePosition('POS-1', { exitPrice: 110 }, key)).rejects.toThrow(/invalid/i);
    expect(localStorage.getItem(TRADING_STORE_STORAGE_KEY)).toBe(before);
    expect(readTradingStore().appliedCommands?.[key]).toBeUndefined();
  });

  it('round-trips server-owned version, currency and extension fields through subsequent commands', async () => {
    const requests: any[] = [];
    server.use(http.post('*/api/portfolio/state/commands', async ({ request }) => {
      const sent = await request.json() as any;
      requests.push(sent);
      return HttpResponse.json({
        ...sent.snapshot, revision: sent.snapshot.revision + 1,
        strategy: { ...sent.snapshot.strategy, operator_metadata: { review_source: 'canonical' } },
        positions: [{ ...sent.snapshot.positions[0], version: 7, quote_currency: 'USD', account_currency: 'EUR', accounting_metadata: { execution_venue: 'XNAS' } }],
      });
    }));
    await submitOrder('ORD-1');
    await cancelOrder('ORD-1');
    expect(requests[1].snapshot.positions[0]).toMatchObject({ version: 7, quote_currency: 'USD', account_currency: 'EUR', accounting_metadata: { execution_venue: 'XNAS' } });
    expect(requests[1].snapshot.strategy.operator_metadata).toEqual({ review_source: 'canonical' });
  });

  it('preserves nested extension metadata without aliasing the stored snapshot', async () => {
    const requests: any[] = [];
    server.use(http.post('*/api/portfolio/state/commands', async ({ request }) => {
      const sent = await request.json() as any;
      requests.push(sent);
      return HttpResponse.json({
        ...sent.snapshot,
        revision: sent.snapshot.revision + 1,
        strategy: {
          ...sent.snapshot.strategy,
          universe: {
            ...sent.snapshot.strategy.universe,
            trend: { ...sent.snapshot.strategy.universe.trend, extension_metadata: { source: 'canonical' } },
          },
        },
        positions: [{
          ...sent.snapshot.positions[0],
          partial_closes: [{ ...sent.snapshot.positions[0].partial_closes[0], event_metadata: { source: 'canonical' } }],
        }],
      });
    }));
    await submitOrder('ORD-1');
    const outboundSnapshot = tradingSnapshotLocal();
    (outboundSnapshot.strategy.universe.trend as any).extension_metadata.source = 'mutated';
    expect((readTradingStore().strategies[0].universe.trend as any).extensionMetadata).toEqual({ source: 'canonical' });
    await cancelOrder('ORD-1');
    expect(requests[1].snapshot.strategy.universe.trend.extension_metadata).toEqual({ source: 'canonical' });
    expect(requests[1].snapshot.positions[0].partial_closes[0].event_metadata).toEqual({ source: 'canonical' });
  });
});
