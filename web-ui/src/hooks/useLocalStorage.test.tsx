import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocalStorage } from '@/hooks/useLocalStorage'

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('returns default value when key is missing and persists it', async () => {
    const { result } = renderHook(() => useLocalStorage('theme', 'dark'))

    expect(result.current[0]).toBe('dark')

    await waitFor(() => {
      expect(localStorage.getItem('theme')).toBe(JSON.stringify('dark'))
    })
  })

  it('loads JSON value and applies transformer', () => {
    localStorage.setItem('risk', JSON.stringify(-2))

    const { result } = renderHook(() =>
      useLocalStorage('risk', 1, (value) => Math.max(0, Number(value) || 0))
    )

    expect(result.current[0]).toBe(0)
  })

  it('falls back to legacy raw strings when JSON parsing fails', () => {
    const warningSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    localStorage.setItem('universe', 'usd_all')

    const { result } = renderHook(() =>
      useLocalStorage('universe', 'all', (value) => String(value).toUpperCase())
    )

    expect(result.current[0]).toBe('USD_ALL')
    expect(warningSpy).toHaveBeenCalled()
  })

  it('supports functional updates and persists transformed values', async () => {
    const { result } = renderHook(() =>
      useLocalStorage('count', 2, (value) => {
        const asNumber = Number(value)
        return Number.isFinite(asNumber) && asNumber >= 0 ? asNumber : 0
      })
    )

    act(() => {
      result.current[1]((previous) => previous - 5)
    })

    expect(result.current[0]).toBe(0)

    await waitFor(() => {
      expect(localStorage.getItem('count')).toBe('0')
    })
  })

  it('keeps previous value when transformer throws during updates', async () => {
    const warningSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { result } = renderHook(() =>
      useLocalStorage('count', 2, (value) => {
        const asNumber = Number(value)
        if (!Number.isFinite(asNumber)) {
          throw new Error('Invalid number')
        }
        return asNumber
      })
    )

    act(() => {
      result.current[1](Number.NaN)
    })

    expect(result.current[0]).toBe(2)

    await waitFor(() => {
      expect(localStorage.getItem('count')).toBe('2')
    })
    expect(warningSpy).toHaveBeenCalled()
  })
})
