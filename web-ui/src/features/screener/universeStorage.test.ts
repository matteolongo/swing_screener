import { describe, expect, it } from 'vitest'
import {
  parseUniverseFromStorage,
  parseUniverseValue,
  migrateRemovedUniverseIds,
  SCREENER_UNIVERSE_STORAGE_KEY,
} from '@/features/screener/universeStorage'

describe('universeStorage', () => {
  it('parses universe from JSON string', () => {
    expect(parseUniverseFromStorage('"us_all"')).toBe('us_all')
    expect(parseUniverseFromStorage('"amsterdam_aex"')).toBe('amsterdam_aex')
    expect(parseUniverseFromStorage(null)).toBeNull()
  })

  it('parses universe from raw string (no JSON wrapping)', () => {
    expect(parseUniverseFromStorage('us_all')).toBe('us_all')
    expect(parseUniverseFromStorage('europe_large_eur')).toBe('europe_large_eur')
  })

  it('strips double-quoted legacy format', () => {
    // Legacy format: ""us_all"" (double-double-quoted)
    expect(parseUniverseFromStorage('""us_all""')).toBe('us_all')
  })

  it('does not resolve old aliases — old ids pass through as-is', () => {
    // No alias resolution: mega_all is returned as-is (API will 422 it)
    expect(parseUniverseFromStorage('"mega_all"')).toBe('mega_all')
    expect(parseUniverseValue('mega_stocks')).toBe('mega_stocks')
  })

  it('returns null for empty or null input', () => {
    expect(parseUniverseFromStorage('')).toBeNull()
    expect(parseUniverseFromStorage(null)).toBeNull()
    expect(parseUniverseValue('')).toBeNull()
    expect(parseUniverseValue(null)).toBeNull()
  })

  it('SCREENER_UNIVERSE_STORAGE_KEY is defined', () => {
    expect(SCREENER_UNIVERSE_STORAGE_KEY).toBe('screener.universe')
  })
})

describe('migrateRemovedUniverseIds', () => {
  function makeStorage(initial: Record<string, string> = {}): Storage {
    const map = new Map(Object.entries(initial))
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, v) },
      removeItem: (k: string) => { map.delete(k) },
      clear: () => { map.clear() },
      get length() { return map.size },
      key: (i: number) => [...map.keys()][i] ?? null,
    } as Storage
  }

  it('rewrites a known removed id to its replacement', () => {
    const storage = makeStorage({ [SCREENER_UNIVERSE_STORAGE_KEY]: '"eur_amsterdam_aex"' })
    migrateRemovedUniverseIds(storage)
    expect(storage.getItem(SCREENER_UNIVERSE_STORAGE_KEY)).toBe('"amsterdam_aex"')
  })

  it('rewrites eur_all (no replacement) to the default', () => {
    const storage = makeStorage({ [SCREENER_UNIVERSE_STORAGE_KEY]: '"eur_all"' })
    migrateRemovedUniverseIds(storage)
    expect(storage.getItem(SCREENER_UNIVERSE_STORAGE_KEY)).toBe('"us_all"')
  })

  it('rewrites mega_all to us_all', () => {
    const storage = makeStorage({ [SCREENER_UNIVERSE_STORAGE_KEY]: '"mega_all"' })
    migrateRemovedUniverseIds(storage)
    expect(storage.getItem(SCREENER_UNIVERSE_STORAGE_KEY)).toBe('"us_all"')
  })

  it('does not touch a valid current id', () => {
    const storage = makeStorage({ [SCREENER_UNIVERSE_STORAGE_KEY]: '"us_all"' })
    migrateRemovedUniverseIds(storage)
    expect(storage.getItem(SCREENER_UNIVERSE_STORAGE_KEY)).toBe('"us_all"')
  })

  it('does nothing when storage key is absent', () => {
    const storage = makeStorage()
    migrateRemovedUniverseIds(storage)
    expect(storage.getItem(SCREENER_UNIVERSE_STORAGE_KEY)).toBeNull()
  })
})
