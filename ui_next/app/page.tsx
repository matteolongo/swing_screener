'use client';

import React from 'react';
import { Box, Container, Paper, Stack, Typography } from '@mui/material';
import OrdersTable from '@/components/OrdersTable';
import PositionsTable from '@/components/PositionsTable';
import PreviewPanel from '@/components/PreviewPanel';
import RoutinePanel from '@/components/RoutinePanel';
import {
  applyChanges,
  getOrders,
  getPositions,
  previewChanges,
  runScreening,
} from '@/lib/api';
import type {
  Order,
  OrderPatch,
  Position,
  PositionPatch,
  PreviewDiff,
  ScreeningRequest,
  ScreeningResponse,
} from '@/lib/types';

const LAST_RUN_KEY = 'swing_last_run';

const ORDER_PATCH_FIELDS: (keyof OrderPatch)[] = [
  'status',
  'order_type',
  'limit_price',
  'quantity',
  'stop_price',
  'order_date',
  'filled_date',
  'entry_price',
  'notes',
  'locked',
];

const POSITION_PATCH_FIELDS: (keyof PositionPatch)[] = ['status', 'stop_price', 'locked'];

function buildOrderPatches(baseline: Order[], current: Order[]): OrderPatch[] {
  const baselineById = new Map(baseline.map((o) => [o.order_id, o]));
  return current.reduce<OrderPatch[]>((acc, order) => {
    const original = baselineById.get(order.order_id);
    if (!original) return acc;
    const patch: OrderPatch = { order_id: order.order_id };
    let changed = false;
    ORDER_PATCH_FIELDS.forEach((field) => {
      const currentValue = order[field as keyof Order];
      const originalValue = original[field as keyof Order];
      if (currentValue !== originalValue) {
        (patch as unknown as Record<string, unknown>)[field] = currentValue;
        changed = true;
      }
    });
    if (changed) acc.push(patch);
    return acc;
  }, []);
}

function buildPositionPatches(baseline: Position[], current: Position[]): PositionPatch[] {
  const baselineByTicker = new Map(baseline.map((p) => [p.ticker, p]));
  return current.reduce<PositionPatch[]>((acc, position) => {
    const original = baselineByTicker.get(position.ticker);
    if (!original) return acc;
    const patch: PositionPatch = { ticker: position.ticker };
    let changed = false;
    POSITION_PATCH_FIELDS.forEach((field) => {
      const currentValue = position[field as keyof Position];
      const originalValue = original[field as keyof Position];
      if (currentValue !== originalValue) {
        (patch as unknown as Record<string, unknown>)[field] = currentValue;
        changed = true;
      }
    });
    if (changed) acc.push(patch);
    return acc;
  }, []);
}

export default function Home() {
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [positions, setPositions] = React.useState<Position[]>([]);
  const [baselineOrders, setBaselineOrders] = React.useState<Order[]>([]);
  const [baselinePositions, setBaselinePositions] = React.useState<Position[]>([]);
  const [preview, setPreview] = React.useState<PreviewDiff | null>(null);
  const [screening, setScreening] = React.useState<ScreeningResponse | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastRun, setLastRun] = React.useState<string | null>(null);

  React.useEffect(() => {
    const stored = window.localStorage.getItem(LAST_RUN_KEY);
    if (stored) setLastRun(stored);
  }, []);

  const refreshData = React.useCallback(async () => {
    const [ordersRes, positionsRes] = await Promise.all([getOrders(), getPositions()]);
    setOrders(ordersRes.orders);
    setPositions(positionsRes.positions);
    setBaselineOrders(ordersRes.orders);
    setBaselinePositions(positionsRes.positions);
  }, []);

  React.useEffect(() => {
    refreshData().catch((err) => setError(err.message || 'Failed to load data.'));
  }, [refreshData]);

  const handleOrderChange = React.useCallback(
    (orderId: string, field: keyof Order, value: Order[keyof Order]) => {
      setOrders((prev) =>
        prev.map((order) => (order.order_id === orderId ? { ...order, [field]: value } : order))
      );
    },
    []
  );

  const handlePositionChange = React.useCallback(
    (ticker: string, field: keyof Position, value: Position[keyof Position]) => {
      setPositions((prev) =>
        prev.map((position) =>
          position.ticker === ticker ? { ...position, [field]: value } : position
        )
      );
    },
    []
  );

  const handleOrderLock = React.useCallback((orderId: string, locked: boolean) => {
    setOrders((prev) =>
      prev.map((order) => (order.order_id === orderId ? { ...order, locked } : order))
    );
    const target = orders.find((order) => order.order_id === orderId);
    if (!target) return;
    const ticker = target.ticker;
    setOrders((prev) =>
      prev.map((order) => (order.ticker === ticker ? { ...order, locked } : order))
    );
    setPositions((prev) =>
      prev.map((position) => (position.ticker === ticker ? { ...position, locked } : position))
    );
  }, [orders]);

  const handlePositionLock = React.useCallback((ticker: string, locked: boolean) => {
    setPositions((prev) =>
      prev.map((position) => (position.ticker === ticker ? { ...position, locked } : position))
    );
    setOrders((prev) =>
      prev.map((order) => (order.ticker === ticker ? { ...order, locked } : order))
    );
  }, []);

  const handlePreview = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const orderPatches = buildOrderPatches(baselineOrders, orders);
      const positionPatches = buildPositionPatches(baselinePositions, positions);
      const result = await previewChanges({ orders: orderPatches, positions: positionPatches });
      setPreview(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Preview failed.');
    } finally {
      setBusy(false);
    }
  }, [baselineOrders, baselinePositions, orders, positions]);

  const handleApply = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const orderPatches = buildOrderPatches(baselineOrders, orders);
      const positionPatches = buildPositionPatches(baselinePositions, positions);
      await applyChanges({ orders: orderPatches, positions: positionPatches });
      await refreshData();
      setPreview(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Apply failed.');
    } finally {
      setBusy(false);
    }
  }, [baselineOrders, baselinePositions, orders, positions, refreshData]);

  const handleScreening = React.useCallback(
    async (config: ScreeningRequest) => {
      setBusy(true);
      setError(null);
      try {
        const result = await runScreening(config);
        setScreening(result);
        const now = new Date().toISOString().slice(0, 10);
        window.localStorage.setItem(LAST_RUN_KEY, now);
        setLastRun(now);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Screening failed.');
      } finally {
        setBusy(false);
      }
    },
    []
  );

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h1">Swing Screener Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage orders and positions in one place. Preview changes before applying.
          </Typography>
        </Box>

        <RoutinePanel
          lastRun={lastRun}
          onRunScreening={handleScreening}
          onPreview={handlePreview}
          onApply={handleApply}
          screening={screening}
          busy={busy}
        />

        {error && (
          <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'error.main' }}>
            <Typography color="error">{error}</Typography>
          </Paper>
        )}

        <Paper elevation={0} sx={{ p: 2 }}>
          <Typography variant="h2" gutterBottom>
            Orders
          </Typography>
          <OrdersTable
            orders={orders}
            onOrderChange={handleOrderChange}
            onToggleLock={handleOrderLock}
          />
        </Paper>

        <Paper elevation={0} sx={{ p: 2 }}>
          <Typography variant="h2" gutterBottom>
            Positions
          </Typography>
          <PositionsTable
            positions={positions}
            onPositionChange={handlePositionChange}
            onToggleLock={handlePositionLock}
          />
        </Paper>

        <PreviewPanel preview={preview} error={error} />
      </Stack>
    </Container>
  );
}
