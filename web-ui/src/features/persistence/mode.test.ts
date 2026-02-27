import { describe, expect, it, vi } from 'vitest';
import { getPersistenceMode } from '@/features/persistence';

describe('persistence mode selection', () => {
  it('defaults to api when unset', () => {
    vi.stubEnv('VITE_PERSISTENCE_MODE', '');
    vi.stubEnv('VITE_ENABLE_LOCAL_PERSISTENCE', '');
    expect(getPersistenceMode()).toBe('api');
  });

  it('stays api when local mode is set without explicit opt-in', () => {
    vi.stubEnv('VITE_PERSISTENCE_MODE', 'local');
    vi.stubEnv('VITE_ENABLE_LOCAL_PERSISTENCE', 'false');
    expect(getPersistenceMode()).toBe('api');
  });

  it('uses local only when local mode and local opt-in are both enabled', () => {
    vi.stubEnv('VITE_PERSISTENCE_MODE', 'local');
    vi.stubEnv('VITE_ENABLE_LOCAL_PERSISTENCE', 'true');
    expect(getPersistenceMode()).toBe('local');
  });

  it('keeps api mode even if local opt-in flag is true', () => {
    vi.stubEnv('VITE_PERSISTENCE_MODE', 'api');
    vi.stubEnv('VITE_ENABLE_LOCAL_PERSISTENCE', 'true');
    expect(getPersistenceMode()).toBe('api');
  });
});
