import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closePositionLocal,
  createOrderLocal,
  fillOrderLocal,
  listOrdersLocal,
  listPositionsLocal,
  mutateTradingStore,
  portfolioSummaryLocal,
  resetTradingStore,
  updatePositionStopLocal,
} from '@/features/persistence';

describe('portfolio local persistence service', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_PERSISTENCE_MODE', 'local');
    vi.stubEnv('VITE_ENABLE_LOCAL_PERSISTENCE', 'true');
    resetTradingStore();
  });

  it('creates and fills an entry order with linked position/stop order', () => {
    createOrderLocal({
      ticker: 'AAPL',
      orderType: 'BUY_LIMIT',
      quantity: 10,
      limitPrice: 100,
      stopPrice: 95,
      orderKind: 'entry',
    });

    const pendingBeforeFill = listOrdersLocal('pending');
    expect(pendingBeforeFill).toHaveLength(1);

    fillOrderLocal(pendingBeforeFill[0].orderId, {
      filledPrice: 101,
      filledDate: '2026-02-26',
      stopPrice: 95,
    });

    const allOrders = listOrdersLocal('all');
    const openPositions = listPositionsLocal('open');

    expect(allOrders.filter((order) => order.status === 'filled')).toHaveLength(1);
    expect(allOrders.filter((order) => order.orderKind === 'stop' && order.status === 'pending')).toHaveLength(1);
    expect(openPositions).toHaveLength(1);
    expect(openPositions[0].ticker).toBe('AAPL');
  });

  it('replaces linked stop order on stop update and supports close', () => {
    createOrderLocal({
      ticker: 'MSFT',
      orderType: 'BUY_LIMIT',
      quantity: 5,
      limitPrice: 200,
      stopPrice: 190,
      orderKind: 'entry',
    });

    const entryOrder = listOrdersLocal('pending')[0];
    fillOrderLocal(entryOrder.orderId, {
      filledPrice: 201,
      filledDate: '2026-02-26',
      stopPrice: 190,
    });

    const position = listPositionsLocal('open')[0];
    updatePositionStopLocal(position.positionId!, {
      newStop: 195.126,
      reason: 'trail',
    });

    const pendingStopOrders = listOrdersLocal('pending').filter((order) => order.orderKind === 'stop');
    expect(pendingStopOrders).toHaveLength(1);
    expect(pendingStopOrders[0].stopPrice).toBe(195.13);

    closePositionLocal(position.positionId!, { exitPrice: 210, feeEur: 4.9, reason: 'target hit' });

    const closedPositions = listPositionsLocal('all').filter((item) => item.positionId === position.positionId);
    expect(closedPositions).toHaveLength(1);
    expect(closedPositions[0].exitFeeEur).toBe(4.9);

    const summary = portfolioSummaryLocal();
    expect(summary.totalPositions).toBe(0);
  });

  it('auto-merges repeated entry fills into the existing open position', () => {
    createOrderLocal({
      ticker: 'REP.MC',
      orderType: 'BUY_LIMIT',
      quantity: 10,
      limitPrice: 12,
      stopPrice: 11,
      orderKind: 'entry',
    });

    const firstEntry = listOrdersLocal('pending')[0];
    fillOrderLocal(firstEntry.orderId, {
      filledPrice: 12,
      filledDate: '2026-03-10',
      stopPrice: 11,
    });

    createOrderLocal({
      ticker: 'REP.MC',
      orderType: 'BUY_LIMIT',
      quantity: 5,
      limitPrice: 13,
      stopPrice: 12.2,
      orderKind: 'entry',
    });

    const secondEntry = listOrdersLocal('pending').find(
      (order) => order.ticker === 'REP.MC' && order.orderKind === 'entry',
    );
    expect(secondEntry).toBeDefined();

    fillOrderLocal(secondEntry!.orderId, {
      filledPrice: 13,
      filledDate: '2026-03-11',
      stopPrice: 12.2,
      feeEur: 4.9,
    });

    const openPositions = listPositionsLocal('open');
    expect(openPositions).toHaveLength(1);
    expect(openPositions[0].shares).toBe(15);
    expect(openPositions[0].stopPrice).toBe(11);
    expect(openPositions[0].entryPrice).toBeCloseTo((12 * 10 + 13 * 5) / 15, 10);

    const allOrders = listOrdersLocal('all');
    const filledSecondEntry = allOrders.find((order) => order.orderId === secondEntry!.orderId);
    expect(filledSecondEntry?.status).toBe('filled');
    expect(filledSecondEntry?.positionId).toBe(openPositions[0].positionId);
    expect(filledSecondEntry?.stopPrice).toBe(11);
    expect(filledSecondEntry?.feeEur).toBe(4.9);

    const linkedStop = allOrders.find(
      (order) => order.orderKind === 'stop' && order.positionId === openPositions[0].positionId,
    );
    expect(linkedStop?.quantity).toBe(15);
    expect(linkedStop?.stopPrice).toBe(11);
  });

  it('allows moving stop above entry when current price is unavailable', () => {
    createOrderLocal({
      ticker: 'NVDA',
      orderType: 'BUY_LIMIT',
      quantity: 3,
      limitPrice: 120,
      stopPrice: 110,
      orderKind: 'entry',
    });

    const entryOrder = listOrdersLocal('pending')[0];
    fillOrderLocal(entryOrder.orderId, {
      filledPrice: 121,
      filledDate: '2026-02-26',
      stopPrice: 110,
    });

    const position = listPositionsLocal('open')[0];
    mutateTradingStore((store) => {
      const index = store.positions.findIndex((candidate) => candidate.positionId === position.positionId);
      store.positions[index] = {
        ...store.positions[index],
        currentPrice: undefined,
      };
    });

    updatePositionStopLocal(position.positionId!, {
      newStop: 122,
      reason: 'lock gain',
    });

    const updatedPosition = listPositionsLocal('open')[0];
    expect(updatedPosition.stopPrice).toBe(122);
  });

  it('rejects moving stop above current price when available', () => {
    createOrderLocal({
      ticker: 'META',
      orderType: 'BUY_LIMIT',
      quantity: 4,
      limitPrice: 200,
      stopPrice: 190,
      orderKind: 'entry',
    });

    const entryOrder = listOrdersLocal('pending')[0];
    fillOrderLocal(entryOrder.orderId, {
      filledPrice: 201,
      filledDate: '2026-02-26',
      stopPrice: 190,
    });

    const position = listPositionsLocal('open')[0];
    mutateTradingStore((store) => {
      const index = store.positions.findIndex((candidate) => candidate.positionId === position.positionId);
      store.positions[index] = {
        ...store.positions[index],
        currentPrice: 209,
      };
    });

    expect(() =>
      updatePositionStopLocal(position.positionId!, {
        newStop: 210,
        reason: 'invalid',
      }),
    ).toThrow('must be at or below current price');
  });
});
