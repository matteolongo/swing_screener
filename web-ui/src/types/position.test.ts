import { describe, it, expect } from 'vitest'
import {
  calculatePnL,
  calculatePnLPercent,
  calculateRNow,
  transformPosition,
  type Position,
  type PositionApiResponse,
} from './position'

describe('Position Helper Functions', () => {
  describe('calculatePnL', () => {
    const basePosition: Position = {
      ticker: 'AAPL',
      status: 'open',
      entryDate: '2026-01-01',
      entryPrice: 100,
      stopPrice: 95,
      shares: 10,
    }

    it('uses exitPrice for closed positions', () => {
      const position = { ...basePosition, exitPrice: 110 }
      const pnl = calculatePnL(position)
      expect(pnl).toBe(100) // (110 - 100) * 10
    })

    it('uses currentPrice from position for open positions', () => {
      const position = { ...basePosition, currentPrice: 105 }
      const pnl = calculatePnL(position)
      expect(pnl).toBe(50) // (105 - 100) * 10
    })

    it('uses passed currentPrice parameter over position.currentPrice', () => {
      const position = { ...basePosition, currentPrice: 105 }
      const pnl = calculatePnL(position, 110)
      expect(pnl).toBe(100) // (110 - 100) * 10
    })

    it('falls back to entryPrice when no other price available', () => {
      const position = { ...basePosition }
      const pnl = calculatePnL(position)
      expect(pnl).toBe(0) // (100 - 100) * 10
    })

    it('calculates negative P&L correctly', () => {
      const position = { ...basePosition, exitPrice: 90 }
      const pnl = calculatePnL(position)
      expect(pnl).toBe(-100) // (90 - 100) * 10
    })

    it('handles fractional prices', () => {
      const position = {
        ...basePosition,
        entryPrice: 15.89,
        currentPrice: 16.30,
        shares: 6,
      }
      const pnl = calculatePnL(position)
      expect(pnl).toBeCloseTo(2.46, 2) // (16.30 - 15.89) * 6
    })
  })

  describe('calculatePnLPercent', () => {
    const basePosition: Position = {
      ticker: 'AAPL',
      status: 'open',
      entryDate: '2026-01-01',
      entryPrice: 100,
      stopPrice: 95,
      shares: 10,
    }

    it('calculates percentage gain correctly', () => {
      const position = { ...basePosition, currentPrice: 110 }
      const pnlPct = calculatePnLPercent(position)
      expect(pnlPct).toBe(10) // ((110 - 100) / 100) * 100
    })

    it('calculates percentage loss correctly', () => {
      const position = { ...basePosition, currentPrice: 90 }
      const pnlPct = calculatePnLPercent(position)
      expect(pnlPct).toBe(-10) // ((90 - 100) / 100) * 100
    })

    it('returns 0 when price unchanged', () => {
      const position = { ...basePosition }
      const pnlPct = calculatePnLPercent(position)
      expect(pnlPct).toBe(0)
    })

    it('handles fractional percentages', () => {
      const position = {
        ...basePosition,
        entryPrice: 15.89,
        currentPrice: 16.30,
      }
      const pnlPct = calculatePnLPercent(position)
      expect(pnlPct).toBeCloseTo(2.58, 2) // ((16.30 - 15.89) / 15.89) * 100
    })
  })

  describe('calculateRNow', () => {
    it('calculates positive R-multiple correctly', () => {
      const position: Position = {
        ticker: 'AAPL',
        status: 'open',
        entryDate: '2026-01-01',
        entryPrice: 100,
        stopPrice: 95,
        shares: 10,
        initialRisk: 50, // (100 - 95) * 10
      }
      const rNow = calculateRNow(position, 110)
      expect(rNow).toBe(2) // (110 - 100) * 10 / 50
    })

    it('calculates negative R-multiple correctly', () => {
      const position: Position = {
        ticker: 'AAPL',
        status: 'open',
        entryDate: '2026-01-01',
        entryPrice: 100,
        stopPrice: 95,
        shares: 10,
        initialRisk: 50,
      }
      const rNow = calculateRNow(position, 95)
      expect(rNow).toBe(-1) // (95 - 100) * 10 / 50
    })

    it('returns 0 when initialRisk is undefined', () => {
      const position: Position = {
        ticker: 'AAPL',
        status: 'open',
        entryDate: '2026-01-01',
        entryPrice: 100,
        stopPrice: 95,
        shares: 10,
      }
      const rNow = calculateRNow(position, 110)
      expect(rNow).toBe(0)
    })

    it('returns 0 when initialRisk is 0', () => {
      const position: Position = {
        ticker: 'AAPL',
        status: 'open',
        entryDate: '2026-01-01',
        entryPrice: 100,
        stopPrice: 95,
        shares: 10,
        initialRisk: 0,
      }
      const rNow = calculateRNow(position, 110)
      expect(rNow).toBe(0)
    })
  })

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
