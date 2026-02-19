import { describe, it, expect } from 'vitest'
import {
  transformPosition,
  type PositionApiResponse,
} from './position'

describe('Position Helper Functions', () => {
  describe('transformPosition', () => {
    it('transforms snake_case to camelCase', () => {
      const apiResponse: PositionApiResponse = {
        ticker: 'AAPL',
        status: 'open',
        entry_date: '2026-01-01',
        entry_price: 100,
        stop_price: 95,
        shares: 10,
        position_id: 'POS-AAPL-001',
        source_order_id: 'ORD-AAPL-001',
        initial_risk: 50,
        max_favorable_price: 110,
        exit_date: null,
        exit_price: null,
        current_price: 105,
        notes: 'Test position',
        exit_order_ids: null,
      }

      const result = transformPosition(apiResponse)

      expect(result).toEqual({
        ticker: 'AAPL',
        status: 'open',
        entryDate: '2026-01-01',
        entryPrice: 100,
        stopPrice: 95,
        shares: 10,
        positionId: 'POS-AAPL-001',
        sourceOrderId: 'ORD-AAPL-001',
        initialRisk: 50,
        maxFavorablePrice: 110,
        exitDate: undefined,
        exitPrice: undefined,
        currentPrice: 105,
        notes: 'Test position',
        exitOrderIds: undefined,
      })
    })

    it('handles null values correctly', () => {
      const apiResponse: PositionApiResponse = {
        ticker: 'AAPL',
        status: 'open',
        entry_date: '2026-01-01',
        entry_price: 100,
        stop_price: 95,
        shares: 10,
        position_id: null,
        source_order_id: null,
        initial_risk: null,
        max_favorable_price: null,
        exit_date: null,
        exit_price: null,
        current_price: null,
        notes: '',
        exit_order_ids: null,
      }

      const result = transformPosition(apiResponse)

      expect(result.positionId).toBeUndefined()
      expect(result.sourceOrderId).toBeUndefined()
      expect(result.initialRisk).toBeUndefined()
      expect(result.maxFavorablePrice).toBeUndefined()
      expect(result.exitDate).toBeUndefined()
      expect(result.exitPrice).toBeUndefined()
      expect(result.currentPrice).toBeUndefined()
      expect(result.exitOrderIds).toBeUndefined()
    })

    it('converts empty string notes to empty string', () => {
      const apiResponse: PositionApiResponse = {
        ticker: 'AAPL',
        status: 'open',
        entry_date: '2026-01-01',
        entry_price: 100,
        stop_price: 95,
        shares: 10,
        position_id: null,
        source_order_id: null,
        initial_risk: null,
        max_favorable_price: null,
        exit_date: null,
        exit_price: null,
        current_price: null,
        notes: '',
        exit_order_ids: null,
      }

      const result = transformPosition(apiResponse)
      expect(result.notes).toBe('')
    })

    it('preserves numeric zero values instead of converting them to undefined', () => {
      const apiResponse: PositionApiResponse = {
        ticker: 'AAPL',
        status: 'open',
        entry_date: '2026-01-01',
        entry_price: 0,
        stop_price: 0,
        shares: 10,
        position_id: 'POS-AAPL-001',
        source_order_id: 'ORD-AAPL-001',
        initial_risk: 0,
        max_favorable_price: 0,
        exit_date: null,
        exit_price: 0,
        current_price: 0,
        notes: 'zero test',
        exit_order_ids: [],
      }

      const result = transformPosition(apiResponse)
      expect(result.initialRisk).toBe(0)
      expect(result.maxFavorablePrice).toBe(0)
      expect(result.exitPrice).toBe(0)
      expect(result.currentPrice).toBe(0)
      expect(result.exitOrderIds).toEqual([])
    })
  })
})
