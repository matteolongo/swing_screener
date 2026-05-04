import type {
  ClosePositionRequest,
  CreateOrderRequest,
  FillOrderRequest,
  Order,
  OrderStatus,
  Position,
  PositionStatus,
  UpdateStopRequest,
} from '@/features/portfolio/types';
import {
  currentDateIso,
  nextOrderId,
  nextPositionId,
  randomOrderId,
} from '@/features/persistence/ids';
import { mutateTradingStore, readTradingStore } from '@/features/persistence/storage';

export interface LocalPositionMetrics {
  ticker: string;
  pnl: number;
  pnlPercent: number;
  rNow: number;
  entryValue: number;
  currentValue: number;
  perShareRisk: number;
  totalRisk: number;
}

export interface LocalPositionWithMetrics extends Position {
  pnl: number;
  pnlPercent: number;
  rNow: number;
  entryValue: number;
  currentValue: number;
  perShareRisk: number;
  totalRisk: number;
  feesEur: number;
}

export interface LocalConcentrationGroup {
  country: string;
  riskAmount: number;
  riskPct: number;
  positionCount: number;
  warning: boolean;
}

export interface LocalPortfolioSummary {
  totalPositions: number;
  totalValue: number;
  totalCostBasis: number;
  totalPnl: number;
  totalPnlPercent: number;
  openRisk: number;
  openRiskPercent: number;
  accountSize: number;
  availableCapital: number;
  largestPositionValue: number;
  largestPositionTicker: string;
  bestPerformerTicker: string;
  bestPerformerPnlPct: number;
  worstPerformerTicker: string;
  worstPerformerPnlPct: number;
  avgRNow: number;
  positionsProfitable: number;
  positionsLosing: number;
  winRate: number;
  concentration: LocalConcentrationGroup[];
  realizedPnl: number;
  effectiveAccountSize: number;
}

export type LocalOrderFilterStatus = OrderStatus | 'all';
export type LocalPositionFilterStatus = PositionStatus | 'all';

type LocalOrderKind = 'entry' | 'stop' | 'take_profit';

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeTicker(value: string): string {
  return value.trim().toUpperCase();
}

function countryFromTicker(ticker: string): string {
  const suffixMap: Record<string, string> = {
    '.AS': 'NL',
    '.PA': 'FR',
    '.DE': 'DE',
    '.MC': 'ES',
    '.MI': 'IT',
    '.ST': 'SE',
    '.L': 'UK',
    '.BR': 'BE',
    '.LS': 'PT',
    '.HE': 'FI',
    '.CO': 'DK',
    '.OL': 'NO',
  };
  const normalized = normalizeTicker(ticker);
  for (const [suffix, country] of Object.entries(suffixMap)) {
    if (normalized.endsWith(suffix)) return country;
  }
  return 'US';
}

function roundToCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundToFourDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function concentrationGroups(positions: LocalPositionWithMetrics[], openRisk: number): LocalConcentrationGroup[] {
  const countryRisk = new Map<string, number>();
  const countryCount = new Map<string, number>();
  for (const position of positions) {
    if (position.totalRisk <= 0) continue;
    const country = countryFromTicker(position.ticker);
    countryRisk.set(country, (countryRisk.get(country) ?? 0) + position.totalRisk);
    countryCount.set(country, (countryCount.get(country) ?? 0) + 1);
  }

  return Array.from(countryRisk.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([country, riskAmount]) => {
      const riskPct = openRisk > 0 ? (riskAmount / openRisk) * 100 : 0;
      return {
        country,
        riskAmount,
        riskPct,
        positionCount: countryCount.get(country) ?? 0,
        warning: riskPct >= 60,
      };
    });
}

function inferOrderKind(order: Pick<Order, 'orderKind' | 'orderType'>): LocalOrderKind | null {
  if (order.orderKind) {
    return order.orderKind;
  }
  const normalizedType = order.orderType.trim().toUpperCase();
  if (normalizedType.startsWith('BUY_')) return 'entry';
  if (normalizedType === 'SELL_STOP' || normalizedType === 'STOP') return 'stop';
  if (normalizedType === 'SELL_LIMIT') return 'take_profit';
  return null;
}

function quoteFee(order: Order): number {
  if (order.feeEur == null) return 0;
  if (order.fillFxRate != null && order.fillFxRate > 0) {
    return Math.abs(order.feeEur) * order.fillFxRate;
  }
  return Math.abs(order.feeEur);
}

function feeMapByPosition(orders: Order[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const order of orders) {
    if (order.status !== 'filled' || !order.positionId) continue;
    const current = map.get(order.positionId) ?? 0;
    map.set(order.positionId, current + quoteFee(order));
  }
  return map;
}

function currentPriceForPosition(position: Position): number {
  if (position.status === 'closed') {
    return position.exitPrice ?? position.currentPrice ?? position.entryPrice;
  }
  return position.currentPrice ?? position.entryPrice;
}

function perShareRisk(position: Position): number {
  const direct = position.initialRisk;
  if (direct != null && Number.isFinite(direct) && direct > 0) {
    return direct;
  }
  const computed = position.entryPrice - position.stopPrice;
  return computed > 0 ? computed : 0;
}

function toPositionWithMetrics(position: Position, feesByPosition: Map<string, number>): LocalPositionWithMetrics {
  const currentPrice = currentPriceForPosition(position);
  const entryValue = position.entryPrice * position.shares;
  const currentValue = currentPrice * position.shares;
  const fee = position.positionId ? feesByPosition.get(position.positionId) ?? 0 : 0;
  const pnl = (currentPrice - position.entryPrice) * position.shares - fee;
  const riskPerShare = perShareRisk(position);
  const totalRisk = riskPerShare * position.shares;

  return {
    ...cloneValue(position),
    currentPrice: position.status === 'open' ? currentPrice : position.currentPrice,
    pnl,
    pnlPercent: entryValue > 0 ? (pnl / entryValue) * 100 : 0,
    rNow: totalRisk > 0 ? pnl / totalRisk : 0,
    entryValue,
    currentValue,
    perShareRisk: riskPerShare,
    totalRisk,
    feesEur: fee,
  };
}

function activeAccountSize(): number {
  const store = readTradingStore();
  const active = store.strategies.find((strategy) => strategy.id === store.activeStrategyId);
  if (!active) return 50000;
  return active.risk.accountSize;
}

export function listOrdersLocal(status: LocalOrderFilterStatus): Order[] {
  const store = readTradingStore();
  const filtered = status === 'all'
    ? store.orders
    : store.orders.filter((order) => order.status === status);
  return cloneValue(filtered);
}

export function getAllOrdersLocal(): Order[] {
  return cloneValue(readTradingStore().orders);
}

export function createOrderLocal(request: CreateOrderRequest): void {
  mutateTradingStore((store) => {
    const ticker = normalizeTicker(request.ticker);
    if (!ticker) {
      throw new Error('Ticker cannot be empty');
    }

    const existingIds = new Set(store.orders.map((order) => order.orderId));
    const orderId = nextOrderId(ticker, existingIds);
    const normalizedOrderType = request.orderType.trim().toUpperCase();
    const orderKind = request.orderKind ?? inferOrderKind({ orderKind: null, orderType: normalizedOrderType });
    const openPosition = store.positions.find(
      (position) => position.status === 'open' && normalizeTicker(position.ticker) === ticker,
    );

    if (orderKind === 'entry') {
      const pendingSameSymbolEntry = store.orders.some(
        (order) =>
          order.status === 'pending' &&
          normalizeTicker(order.ticker) === ticker &&
          inferOrderKind(order) === 'entry',
      );
      if (pendingSameSymbolEntry) {
        throw new Error(`${ticker}: pending entry order already exists.`);
      }

      if (request.entryMode === 'ADD_ON') {
        if (!openPosition) {
          throw new Error(`${ticker}: no open position found for add-on order.`);
        }
      } else if (openPosition) {
        throw new Error(`${ticker}: open position already exists. Create this as an ADD_ON order instead.`);
      }
    }

    const order: Order = {
      orderId,
      ticker,
      status: 'pending',
      orderType: normalizedOrderType,
      quantity: request.quantity,
      limitPrice: request.limitPrice ?? null,
      stopPrice: request.stopPrice ?? null,
      orderDate: currentDateIso(),
      filledDate: '',
      entryPrice: null,
      notes: request.notes?.trim() ?? '',
      orderKind,
      parentOrderId: null,
      positionId: request.entryMode === 'ADD_ON' ? (request.positionId ?? openPosition?.positionId ?? null) : null,
      tif: 'GTC',
      feeEur: null,
      fillFxRate: null,
    };

    store.orders.push(order);
  });
}

export function fillOrderLocal(orderId: string, request: FillOrderRequest): void {
  mutateTradingStore((store) => {
    const orderIndex = store.orders.findIndex((order) => order.orderId === orderId);
    if (orderIndex < 0) {
      throw new Error(`Order not found: ${orderId}`);
    }

    const currentOrder = store.orders[orderIndex];
    if (currentOrder.status !== 'pending') {
      throw new Error(`Order not pending: ${currentOrder.status}`);
    }

    const kind = inferOrderKind(currentOrder);

    if (kind === 'entry') {
      if (currentOrder.quantity <= 0) {
        throw new Error('Order quantity must be > 0');
      }
      const openPositionIndex = store.positions.findIndex(
        (position) =>
          position.status === 'open' && normalizeTicker(position.ticker) === normalizeTicker(currentOrder.ticker),
      );
      const openPosition = openPositionIndex >= 0 ? store.positions[openPositionIndex] : undefined;

      if (openPosition) {
        const positionId = openPosition.positionId ?? nextPositionId(openPosition.ticker, openPosition.entryDate, store.positions);
        const totalShares = openPosition.shares + currentOrder.quantity;
        const blendedEntryPrice = (
          (openPosition.entryPrice * openPosition.shares) + (request.filledPrice * currentOrder.quantity)
        ) / totalShares;
        const stopPrice = openPosition.stopPrice;

        if (blendedEntryPrice <= stopPrice) {
          throw new Error('Blended entry must be above stop price.');
        }

        const filledOrder: Order = {
          ...currentOrder,
          status: 'filled',
          filledDate: request.filledDate,
          entryPrice: request.filledPrice,
          quantity: currentOrder.quantity,
          stopPrice,
          orderKind: 'entry',
          positionId,
          tif: currentOrder.tif ?? 'GTC',
          feeEur: request.feeEur ?? null,
          fillFxRate: request.fillFxRate ?? null,
        };
        store.orders[orderIndex] = filledOrder;

        let stopOrderId: string | undefined;
        for (let index = 0; index < store.orders.length; index += 1) {
          if (index === orderIndex) continue;
          const existingOrder = store.orders[index];
          if (existingOrder.positionId !== positionId) continue;

          const existingKind = inferOrderKind(existingOrder);
          if (existingKind === 'stop') {
            stopOrderId = existingOrder.orderId;
            store.orders[index] = {
              ...existingOrder,
              quantity: totalShares,
              stopPrice,
            };
            continue;
          }
          if (existingKind === 'take_profit') {
            store.orders[index] = {
              ...existingOrder,
              quantity: totalShares,
            };
          }
        }

        if (!stopOrderId) {
          stopOrderId = `ORD-STOP-${positionId}`;
          store.orders.push({
            orderId: stopOrderId,
            ticker: currentOrder.ticker,
            status: 'pending',
            orderType: 'SELL_STOP',
            quantity: totalShares,
            limitPrice: null,
            stopPrice,
            orderDate: request.filledDate,
            filledDate: '',
            entryPrice: null,
            notes: 'auto-linked stop (scale-in)',
            orderKind: 'stop',
            parentOrderId: openPosition.sourceOrderId ?? currentOrder.orderId,
            positionId,
            tif: 'GTC',
            feeEur: null,
            fillFxRate: null,
          });
        }

        const exitOrderIds = new Set(openPosition.exitOrderIds ?? []);
        exitOrderIds.add(stopOrderId);
        const currentMaxFavorablePrice = openPosition.maxFavorablePrice ?? openPosition.entryPrice;

        store.positions[openPositionIndex] = {
          ...openPosition,
          positionId,
          entryPrice: blendedEntryPrice,
          stopPrice,
          shares: totalShares,
          initialRisk: roundToFourDecimals(blendedEntryPrice - stopPrice),
          maxFavorablePrice: Math.max(currentMaxFavorablePrice, request.filledPrice),
          exitOrderIds: Array.from(exitOrderIds),
        };
        return;
      }

      const stopPrice = request.stopPrice ?? currentOrder.stopPrice ?? undefined;
      if (stopPrice == null) {
        throw new Error('stop_price is required for entry fills');
      }
      if (stopPrice >= request.filledPrice) {
        throw new Error('stop_price must be below fill_price.');
      }

      const positionId = nextPositionId(currentOrder.ticker, request.filledDate, store.positions);
      const filledOrder: Order = {
        ...currentOrder,
        status: 'filled',
        filledDate: request.filledDate,
        entryPrice: request.filledPrice,
        quantity: currentOrder.quantity,
        stopPrice,
        orderKind: 'entry',
        positionId,
        tif: currentOrder.tif ?? 'GTC',
        feeEur: request.feeEur ?? null,
        fillFxRate: request.fillFxRate ?? null,
      };
      store.orders[orderIndex] = filledOrder;

      const stopOrderId = `ORD-STOP-${positionId}`;
      const stopOrder: Order = {
        orderId: stopOrderId,
        ticker: currentOrder.ticker,
        status: 'pending',
        orderType: 'SELL_STOP',
        quantity: currentOrder.quantity,
        limitPrice: null,
        stopPrice,
        orderDate: request.filledDate,
        filledDate: '',
        entryPrice: null,
        notes: 'auto-linked stop',
        orderKind: 'stop',
        parentOrderId: currentOrder.orderId,
        positionId,
        tif: 'GTC',
        feeEur: null,
        fillFxRate: null,
      };
      store.orders.push(stopOrder);

      const position: Position = {
        ticker: currentOrder.ticker,
        status: 'open',
        entryDate: request.filledDate,
        entryPrice: request.filledPrice,
        stopPrice,
        shares: currentOrder.quantity,
        positionId,
        sourceOrderId: currentOrder.orderId,
        initialRisk: request.filledPrice - stopPrice,
        maxFavorablePrice: request.filledPrice,
        notes: currentOrder.notes,
        exitOrderIds: [stopOrderId],
      };
      store.positions.push(position);
      return;
    }

    store.orders[orderIndex] = {
      ...currentOrder,
      status: 'filled',
      filledDate: request.filledDate,
      entryPrice: request.filledPrice,
      feeEur: request.feeEur ?? null,
      fillFxRate: request.fillFxRate ?? null,
    };
  });
}

export function cancelOrderLocal(orderId: string): void {
  mutateTradingStore((store) => {
    const index = store.orders.findIndex((order) => order.orderId === orderId);
    if (index < 0) {
      throw new Error(`Order not found: ${orderId}`);
    }
    if (store.orders[index].status !== 'pending') {
      throw new Error(`Order not pending: ${store.orders[index].status}`);
    }
    store.orders[index] = {
      ...store.orders[index],
      status: 'cancelled',
    };
  });
}

export function listPositionsLocal(status: LocalPositionFilterStatus): LocalPositionWithMetrics[] {
  const store = readTradingStore();
  const filtered = status === 'all'
    ? store.positions
    : store.positions.filter((position) => position.status === status);
  const feesByPosition = feeMapByPosition(store.orders);
  return filtered.map((position) => toPositionWithMetrics(position, feesByPosition));
}

export function getAllPositionsLocal(): Position[] {
  return cloneValue(readTradingStore().positions);
}

export function getPositionByIdLocal(positionId: string): Position | null {
  const store = readTradingStore();
  const match = store.positions.find((position) => position.positionId === positionId);
  return match ? cloneValue(match) : null;
}

export function positionMetricsLocal(positionId: string): LocalPositionMetrics {
  const store = readTradingStore();
  const position = store.positions.find((item) => item.positionId === positionId);
  if (!position) {
    throw new Error(`Position not found: ${positionId}`);
  }

  const feesByPosition = feeMapByPosition(store.orders);
  const metrics = toPositionWithMetrics(position, feesByPosition);
  return {
    ticker: metrics.ticker,
    pnl: metrics.pnl,
    pnlPercent: metrics.pnlPercent,
    rNow: metrics.rNow,
    entryValue: metrics.entryValue,
    currentValue: metrics.currentValue,
    perShareRisk: metrics.perShareRisk,
    totalRisk: metrics.totalRisk,
  };
}

export function portfolioSummaryLocal(): LocalPortfolioSummary {
  const accountSize = activeAccountSize();
  const closedPositions = listPositionsLocal('closed');
  const realizedPnl = closedPositions.reduce(
    (sum, position) => sum + ((position.exitPrice ?? position.entryPrice) - position.entryPrice) * position.shares - (position.exitFeeEur ?? 0),
    0,
  );
  const effectiveAccountSize = accountSize + realizedPnl;
  const positions = listPositionsLocal('open');
  if (positions.length === 0) {
    return {
      totalPositions: 0,
      totalValue: 0,
      totalCostBasis: 0,
      totalPnl: 0,
      totalPnlPercent: 0,
      openRisk: 0,
      openRiskPercent: 0,
      accountSize,
      availableCapital: accountSize,
      largestPositionValue: 0,
      largestPositionTicker: '',
      bestPerformerTicker: '',
      bestPerformerPnlPct: 0,
      worstPerformerTicker: '',
      worstPerformerPnlPct: 0,
      avgRNow: 0,
      positionsProfitable: 0,
      positionsLosing: 0,
      winRate: 0,
      concentration: [],
      realizedPnl,
      effectiveAccountSize,
    };
  }

  let totalValue = 0;
  let totalCostBasis = 0;
  let totalPnl = 0;
  let openRisk = 0;
  let largestPositionValue = 0;
  let largestPositionTicker = '';
  let bestPerformerTicker = '';
  let bestPerformerPnlPct = Number.NEGATIVE_INFINITY;
  let worstPerformerTicker = '';
  let worstPerformerPnlPct = Number.POSITIVE_INFINITY;
  let totalRNow = 0;
  let rCount = 0;
  let positionsProfitable = 0;
  let positionsLosing = 0;

  positions.forEach((position) => {
    totalValue += position.currentValue;
    totalCostBasis += position.entryValue;
    totalPnl += position.pnl;

    if (position.totalRisk > 0) {
      openRisk += position.totalRisk;
      totalRNow += position.rNow;
      rCount += 1;
    }

    if (position.currentValue > largestPositionValue) {
      largestPositionValue = position.currentValue;
      largestPositionTicker = position.ticker;
    }

    if (position.pnlPercent > bestPerformerPnlPct) {
      bestPerformerPnlPct = position.pnlPercent;
      bestPerformerTicker = position.ticker;
    }

    if (position.pnlPercent < worstPerformerPnlPct) {
      worstPerformerPnlPct = position.pnlPercent;
      worstPerformerTicker = position.ticker;
    }

    if (position.pnl > 0) {
      positionsProfitable += 1;
    } else if (position.pnl < 0) {
      positionsLosing += 1;
    }
  });

  return {
    totalPositions: positions.length,
    totalValue,
    totalCostBasis,
    totalPnl,
    totalPnlPercent: totalCostBasis > 0 ? (totalPnl / totalCostBasis) * 100 : 0,
    openRisk,
    openRiskPercent: effectiveAccountSize > 0 ? (openRisk / effectiveAccountSize) * 100 : 0,
    accountSize,
    availableCapital: effectiveAccountSize - totalValue,
    largestPositionValue,
    largestPositionTicker,
    bestPerformerTicker,
    bestPerformerPnlPct: bestPerformerTicker ? bestPerformerPnlPct : 0,
    worstPerformerTicker,
    worstPerformerPnlPct: worstPerformerTicker ? worstPerformerPnlPct : 0,
    avgRNow: rCount > 0 ? totalRNow / rCount : 0,
    positionsProfitable,
    positionsLosing,
    winRate: positions.length > 0 ? (positionsProfitable / positions.length) * 100 : 0,
    concentration: concentrationGroups(positions, openRisk),
    realizedPnl,
    effectiveAccountSize,
  };
}

export function updatePositionStopLocal(positionId: string, request: UpdateStopRequest): void {
  mutateTradingStore((store) => {
    const positionIndex = store.positions.findIndex((position) => position.positionId === positionId);
    if (positionIndex < 0) {
      throw new Error(`Position not found: ${positionId}`);
    }

    const position = store.positions[positionIndex];
    if (position.status !== 'open') {
      throw new Error('Cannot update stop on closed position');
    }

    const newStop = roundToCents(request.newStop);
    const oldStop = roundToCents(position.stopPrice);

    if (newStop <= oldStop) {
      throw new Error(`Cannot move stop down. Current: ${oldStop}, Requested: ${newStop}`);
    }

    const currentPrice = position.currentPrice;
    if (currentPrice != null && Number.isFinite(currentPrice) && newStop > currentPrice) {
      throw new Error(
        `Stop price (${newStop}) must be at or below current price (${currentPrice}) for long positions`,
      );
    }

    const nextNotes = request.reason
      ? `${position.notes ? `${position.notes}\n` : ''}Stop updated to ${newStop}: ${request.reason}`
      : position.notes;

    store.positions[positionIndex] = {
      ...position,
      stopPrice: newStop,
      notes: nextNotes,
    };

    const cancelledOrderIds: string[] = [];
    store.orders = store.orders.map((order) => {
      if (
        order.positionId === positionId &&
        inferOrderKind(order) === 'stop' &&
        order.status === 'pending'
      ) {
        cancelledOrderIds.push(order.orderId);
        return {
          ...order,
          status: 'cancelled',
          notes: `${order.notes ? `${order.notes}\n` : ''}Replaced with new stop at ${newStop} (was ${oldStop})`,
        };
      }
      return order;
    });

    const replacementOrderId = randomOrderId('ORD');
    const replacementOrder: Order = {
      orderId: replacementOrderId,
      ticker: position.ticker,
      status: 'pending',
      orderType: 'STOP',
      quantity: position.shares,
      limitPrice: null,
      stopPrice: newStop,
      orderDate: currentDateIso(),
      filledDate: '',
      entryPrice: null,
      notes: `Auto-created from position stop update (was ${oldStop})`,
      orderKind: 'stop',
      parentOrderId: position.sourceOrderId ?? null,
      positionId,
      tif: 'GTC',
      feeEur: null,
      fillFxRate: null,
    };

    const existingExitOrders = store.positions[positionIndex].exitOrderIds ?? [];
    const nextExitOrders = [
      ...existingExitOrders.filter((orderId) => !cancelledOrderIds.includes(orderId)),
      replacementOrderId,
    ];

    store.positions[positionIndex] = {
      ...store.positions[positionIndex],
      exitOrderIds: nextExitOrders,
    };

    store.orders.push(replacementOrder);
  });
}

export function closePositionLocal(positionId: string, request: ClosePositionRequest): void {
  mutateTradingStore((store) => {
    const index = store.positions.findIndex((position) => position.positionId === positionId);
    if (index < 0) {
      throw new Error(`Position not found: ${positionId}`);
    }

    const current = store.positions[index];
    if (current.status !== 'open') {
      throw new Error('Position already closed');
    }

    store.positions[index] = {
      ...current,
      status: 'closed',
      exitPrice: request.exitPrice,
      exitFeeEur: request.feeEur,
      exitDate: currentDateIso(),
      tags: request.tags ?? [],
      notes: request.reason
        ? `${current.notes ? `${current.notes}\n` : ''}Closed: ${request.reason}`
        : current.notes,
    };
  });
}
