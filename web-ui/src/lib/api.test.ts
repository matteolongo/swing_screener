import { describe, it, expect } from 'vitest'
import { API_BASE_URL, API_ENDPOINTS, apiUrl } from './api'

describe('API Client', () => {
  const expectedBase = import.meta.env.VITE_API_URL || ''
  const expectedUrl = (path: string) => `${expectedBase}${path}`

  describe('API_BASE_URL', () => {
    it('has default base URL', () => {
      expect(API_BASE_URL).toBe(expectedBase)
    })
  })

  describe('API_ENDPOINTS', () => {
    it('has all config endpoints', () => {
      expect(API_ENDPOINTS.config).toBe('/api/config')
      expect(API_ENDPOINTS.configReset).toBe('/api/config/reset')
      expect(API_ENDPOINTS.configDefaults).toBe('/api/config/defaults')
    })

    it('has all strategy endpoints', () => {
      expect(API_ENDPOINTS.strategy).toBe('/api/strategy')
      expect(API_ENDPOINTS.strategyActive).toBe('/api/strategy/active')
      expect(API_ENDPOINTS.strategyById('strat-1')).toBe('/api/strategy/strat-1')
    })

    it('has all screener endpoints', () => {
      expect(API_ENDPOINTS.screenerRun).toBe('/api/screener/run')
      expect(API_ENDPOINTS.screenerUniverses).toBe('/api/screener/universes')
      expect(API_ENDPOINTS.screenerPreview).toBe('/api/screener/preview-order')
    })

    it('has all portfolio endpoints', () => {
      expect(API_ENDPOINTS.positions).toBe('/api/portfolio/positions')
      expect(API_ENDPOINTS.orders).toBe('/api/portfolio/orders')
      expect(API_ENDPOINTS.ordersSnapshot).toBe('/api/portfolio/orders/snapshot')
    })

    it('has dynamic position endpoint function', () => {
      expect(API_ENDPOINTS.position('POS-123')).toBe('/api/portfolio/positions/POS-123')
      expect(API_ENDPOINTS.positionStop('POS-123')).toBe('/api/portfolio/positions/POS-123/stop')
      expect(API_ENDPOINTS.positionClose('POS-123')).toBe('/api/portfolio/positions/POS-123/close')
    })

    it('has dynamic order endpoint function', () => {
      expect(API_ENDPOINTS.order('ORD-123')).toBe('/api/portfolio/orders/ORD-123')
      expect(API_ENDPOINTS.orderFill('ORD-123')).toBe('/api/portfolio/orders/ORD-123/fill')
    })
  })

  describe('apiUrl', () => {
    it('constructs full URLs correctly', () => {
      expect(apiUrl('/api/config')).toBe(expectedUrl('/api/config'))
      expect(apiUrl('/api/portfolio/positions')).toBe(expectedUrl('/api/portfolio/positions'))
    })

    it('handles endpoints with query parameters', () => {
      expect(apiUrl('/api/portfolio/positions?status=open')).toBe(
        expectedUrl('/api/portfolio/positions?status=open')
      )
    })

    it('handles absolute paths', () => {
      expect(apiUrl('/api/screener/run')).toBe(expectedUrl('/api/screener/run'))
    })
  })
})
