import type { Strategy } from '@/features/strategy/types';
import { DEFAULT_STRATEGY_ID } from '@/features/persistence/schema';
import { mutateTradingStore, readTradingStore } from '@/features/persistence/storage';

function cloneStrategy(strategy: Strategy): Strategy {
  return JSON.parse(JSON.stringify(strategy)) as Strategy;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function listStrategiesLocal(): Strategy[] {
  const store = readTradingStore();
  return store.strategies.map(cloneStrategy);
}

export function getActiveStrategyLocal(): Strategy {
  const store = readTradingStore();
  const active = store.strategies.find((strategy) => strategy.id === store.activeStrategyId);
  if (active) {
    return cloneStrategy(active);
  }

  const fallback = store.strategies.find((strategy) => strategy.id === DEFAULT_STRATEGY_ID);
  if (fallback) {
    return cloneStrategy(fallback);
  }

  throw new Error('No active strategy available');
}

export function setActiveStrategyLocal(strategyId: string): Strategy {
  let active: Strategy | null = null;

  mutateTradingStore((store) => {
    const target = store.strategies.find((strategy) => strategy.id === strategyId);
    if (!target) {
      throw new Error(`Strategy not found: ${strategyId}`);
    }
    store.activeStrategyId = strategyId;
    active = cloneStrategy(target);
  });

  if (!active) {
    throw new Error('Failed to set active strategy');
  }
  return active;
}

export function updateStrategyLocal(strategy: Strategy): Strategy {
  let updated: Strategy | null = null;

  mutateTradingStore((store) => {
    const index = store.strategies.findIndex((item) => item.id === strategy.id);
    if (index < 0) {
      throw new Error(`Strategy not found: ${strategy.id}`);
    }

    const existing = store.strategies[index];
    const next: Strategy = {
      ...cloneStrategy(strategy),
      id: existing.id,
      isDefault: existing.isDefault,
      createdAt: existing.createdAt,
      updatedAt: nowIso(),
    };
    store.strategies[index] = next;
    updated = cloneStrategy(next);
  });

  if (!updated) {
    throw new Error('Failed to update strategy');
  }
  return updated;
}

export function deleteStrategyLocal(strategyId: string): void {
  mutateTradingStore((store) => {
    if (strategyId === DEFAULT_STRATEGY_ID) {
      throw new Error('Default strategy cannot be deleted.');
    }

    const strategy = store.strategies.find((item) => item.id === strategyId);
    if (!strategy) {
      throw new Error(`Strategy not found: ${strategyId}`);
    }
    if (strategy.isDefault) {
      throw new Error('Default strategy cannot be deleted.');
    }

    store.strategies = store.strategies.filter((item) => item.id !== strategyId);
    if (store.activeStrategyId === strategyId) {
      store.activeStrategyId = DEFAULT_STRATEGY_ID;
    }
  });
}

export function createStrategyLocal(
  strategyTemplate: Strategy,
  payload: { id: string; name: string; description?: string },
): Strategy {
  const normalizedId = payload.id.trim();
  const normalizedName = payload.name.trim();
  if (!normalizedId) {
    throw new Error('Strategy id is required');
  }
  if (!normalizedName) {
    throw new Error('Strategy name is required');
  }
  if (normalizedId === DEFAULT_STRATEGY_ID) {
    throw new Error("Cannot create strategy with reserved id 'default'.");
  }

  let created: Strategy | null = null;
  mutateTradingStore((store) => {
    if (store.strategies.some((strategy) => strategy.id === normalizedId)) {
      throw new Error(`Strategy already exists: ${normalizedId}`);
    }

    const timestamp = nowIso();
    const next: Strategy = {
      ...cloneStrategy(strategyTemplate),
      id: normalizedId,
      name: normalizedName,
      description:
        payload.description && payload.description.trim().length > 0
          ? payload.description.trim()
          : strategyTemplate.description,
      isDefault: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    store.strategies.push(next);
    created = cloneStrategy(next);
  });

  if (!created) {
    throw new Error('Failed to create strategy');
  }
  return created;
}
