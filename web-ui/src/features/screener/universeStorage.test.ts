import { describe, expect, it, vi } from 'vitest'
import {
  migrateLegacyScreenerStorage,
  parseUniverseFromStorage,
  parseUniverseValue,
  SCREENER_CURRENCY_FILTER_STORAGE_KEY,
  SCREENER_UNIVERSE_STORAGE_KEY,
} from '@/features/screener/universeStorage'

describe('universeStorage', () => {
  it('normalizes aliased universe values', () => {
    expect(parseUniverseValue('mega')).toBe('usd_all')
    expect(parseUniverseValue('mega_stocks')).toBe('usd_mega_stocks')
    expect(parseUniverseValue('eur_amsterdam_all')).toBe('eur_amsterdam_all')
  })

  it('parses universe from JSON and legacy raw strings', () => {
    expect(parseUniverseFromStorage('"mega"')).toBe('usd_all')
    expect(parseUniverseFromStorage('mega_stocks')).toBe('usd_mega_stocks')
    expect(parseUniverseFromStorage('""mega_all""')).toBe('usd_all')
    expect(parseUniverseFromStorage(null)).toBeNull()
  })

  it('migrates legacy screener storage values', () => {
    const values: Record<string, string | null> = {
      [SCREENER_UNIVERSE_STORAGE_KEY]: 'mega',
      [SCREENER_CURRENCY_FILTER_STORAGE_KEY]: 'all',
    }

    const storage = {
      getItem: vi.fn((key: string) => values[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        values[key] = value
      }),
    }

    migrateLegacyScreenerStorage(storage)

    expect(storage.setItem).toHaveBeenCalledWith(SCREENER_UNIVERSE_STORAGE_KEY, '"mega"')
    expect(storage.setItem).toHaveBeenCalledWith(SCREENER_CURRENCY_FILTER_STORAGE_KEY, '"all"')
  })
})
