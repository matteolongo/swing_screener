import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createStrategyLocal,
  deleteStrategyLocal,
  getActiveStrategyLocal,
  listStrategiesLocal,
  resetTradingStore,
  setActiveStrategyLocal,
  updateStrategyLocal,
} from '@/features/persistence';

describe('strategy local persistence service', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_PERSISTENCE_MODE', 'local');
    vi.stubEnv('VITE_ENABLE_LOCAL_PERSISTENCE', 'true');
    resetTradingStore();
  });

  it('seeds with a default strategy and active id', () => {
    const strategies = listStrategiesLocal();
    const active = getActiveStrategyLocal();

    expect(strategies).toHaveLength(1);
    expect(strategies[0].id).toBe('default');
    expect(active.id).toBe('default');
  });

  it('creates, updates, activates, and deletes a custom strategy', () => {
    const template = getActiveStrategyLocal();
    const created = createStrategyLocal(template, {
      id: 'swing_v2',
      name: 'Swing v2',
      description: 'Custom strategy',
    });

    expect(created.id).toBe('swing_v2');
    expect(listStrategiesLocal()).toHaveLength(2);

    const active = setActiveStrategyLocal('swing_v2');
    expect(active.id).toBe('swing_v2');

    const updated = updateStrategyLocal({
      ...active,
      name: 'Swing v2 Updated',
    });
    expect(updated.name).toBe('Swing v2 Updated');

    deleteStrategyLocal('swing_v2');
    expect(listStrategiesLocal()).toHaveLength(1);
    expect(getActiveStrategyLocal().id).toBe('default');
  });
});
