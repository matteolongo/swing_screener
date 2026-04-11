import { describe, expect, it } from 'vitest'
import {
  parseUniverseFromStorage,
  parseUniverseValue,
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
