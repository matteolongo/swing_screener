import { describe, it, expect } from 'vitest'
import {
  transformOrder,
  transformCreateOrderRequest,
  type Order,
  type OrderApiResponse,
  type CreateOrderRequest,
} from './order'

describe('Order Type Transformations', () => {
  describe('transformOrder', () => {
    it('transforms snake_case to camelCase for all fields', () => {
      const apiResponse: OrderApiResponse = {
        order_id: 'ORD-AAPL-001',
        ticker: 'AAPL',
        status: 'pending',
        order_kind: 'entry',
        order_type: 'BUY_LIMIT',
        limit_price: 150.50,
        quantity: 10,
        stop_price: 145.00,
        order_date: '2026-02-01',
        filled_date: '',
        entry_price: null,
        position_id: 'POS-AAPL-001',
        parent_order_id: null,
        tif: 'GTC',
        notes: 'Test order',
      }

      const result = transformOrder(apiResponse)

      expect(result).toEqual({
        orderId: 'ORD-AAPL-001',
        ticker: 'AAPL',
        status: 'pending',
        orderKind: 'entry',
        orderType: 'BUY_LIMIT',
        limitPrice: 150.50,
        quantity: 10,
        stopPrice: 145.00,
        orderDate: '2026-02-01',
        filledDate: '',
        entryPrice: undefined,
        positionId: 'POS-AAPL-001',
        parentOrderId: undefined,
        tif: 'GTC',
        notes: 'Test order',
      })
    })

    it('transforms SELL_STOP order correctly', () => {
      const apiResponse: OrderApiResponse = {
        order_id: 'ORD-VALE-STOP',
        ticker: 'VALE',
        status: 'pending',
        order_kind: 'stop',
        order_type: 'SELL_STOP',
        limit_price: null,
        quantity: 6,
        stop_price: 14.90,
        order_date: '2026-01-16',
        filled_date: '',
        entry_price: null,
        position_id: 'POS-VALE-001',
        parent_order_id: 'ORD-VALE-ENTRY',
        tif: 'GTC',
        notes: 'trailing stop',
      }

      const result = transformOrder(apiResponse)

      expect(result.limitPrice).toBeUndefined()
      expect(result.stopPrice).toBe(14.90)
      expect(result.orderType).toBe('SELL_STOP')
      expect(result.orderKind).toBe('stop')
    })

    it('handles null values correctly', () => {
      const apiResponse: OrderApiResponse = {
        order_id: 'ORD-TEST',
        ticker: 'TEST',
        status: 'pending',
        order_kind: 'entry',
        order_type: 'BUY_LIMIT',
        limit_price: 100,
        quantity: 10,
        stop_price: null,
        order_date: '2026-02-01',
        filled_date: '',
        entry_price: null,
        position_id: null,
        parent_order_id: null,
        tif: 'GTC',
        notes: '',
      }

      const result = transformOrder(apiResponse)

      expect(result.stopPrice).toBeUndefined()
      expect(result.entryPrice).toBeUndefined()
      expect(result.positionId).toBeUndefined()
      expect(result.parentOrderId).toBeUndefined()
    })

    it('handles filled order with entry price', () => {
      const apiResponse: OrderApiResponse = {
        order_id: 'ORD-FILLED',
        ticker: 'MSFT',
        status: 'filled',
        order_kind: 'entry',
        order_type: 'BUY_LIMIT',
        limit_price: 420.00,
        quantity: 5,
        stop_price: 410.00,
        order_date: '2026-02-01',
        filled_date: '2026-02-02',
        entry_price: 419.50,
        position_id: 'POS-MSFT-001',
        parent_order_id: null,
        tif: 'GTC',
        notes: 'filled below limit',
      }

      const result = transformOrder(apiResponse)

      expect(result.status).toBe('filled')
      expect(result.filledDate).toBe('2026-02-02')
      expect(result.entryPrice).toBe(419.50)
    })

    it('preserves empty strings', () => {
      const apiResponse: OrderApiResponse = {
        order_id: 'ORD-EMPTY',
        ticker: 'EMPTY',
        status: 'pending',
        order_kind: 'entry',
        order_type: 'BUY_LIMIT',
        limit_price: 100,
        quantity: 1,
        stop_price: null,
        order_date: '2026-02-01',
        filled_date: '',
        entry_price: null,
        position_id: null,
        parent_order_id: null,
        tif: 'GTC',
        notes: '',
      }

      const result = transformOrder(apiResponse)

      expect(result.filledDate).toBe('')
      expect(result.notes).toBe('')
    })
  })

  describe('transformCreateOrderRequest', () => {
    it('transforms camelCase to snake_case for create request', () => {
      const request: CreateOrderRequest = {
        ticker: 'AAPL',
        orderType: 'BUY_LIMIT',
        quantity: 10,
        limitPrice: 150.50,
        stopPrice: 145.00,
        notes: 'From screener',
        orderKind: 'entry',
      }

      const result = transformCreateOrderRequest(request)

      expect(result).toEqual({
        ticker: 'AAPL',
        order_type: 'BUY_LIMIT',
        quantity: 10,
        limit_price: 150.50,
        stop_price: 145.00,
        notes: 'From screener',
        order_kind: 'entry',
      })
    })

    it('handles optional stopPrice', () => {
      const request: CreateOrderRequest = {
        ticker: 'AAPL',
        orderType: 'BUY_LIMIT',
        quantity: 10,
        limitPrice: 150.50,
        notes: 'No stop',
        orderKind: 'entry',
      }

      const result = transformCreateOrderRequest(request)

      expect(result.stop_price).toBeUndefined()
    })

    it('transforms SELL_STOP order request', () => {
      const request: CreateOrderRequest = {
        ticker: 'VALE',
        orderType: 'SELL_STOP',
        quantity: 6,
        stopPrice: 14.90,
        notes: 'Stop order',
        orderKind: 'stop',
      }

      const result = transformCreateOrderRequest(request)

      expect(result.order_type).toBe('SELL_STOP')
      expect(result.order_kind).toBe('stop')
      expect(result.stop_price).toBe(14.90)
      expect(result.limit_price).toBeUndefined()
    })

    it('preserves empty notes', () => {
      const request: CreateOrderRequest = {
        ticker: 'TEST',
        orderType: 'BUY_LIMIT',
        quantity: 1,
        limitPrice: 100,
        notes: '',
        orderKind: 'entry',
      }

      const result = transformCreateOrderRequest(request)

      expect(result.notes).toBe('')
    })

    it('handles all order types correctly', () => {
      const orderTypes: Array<CreateOrderRequest['orderType']> = [
        'BUY_LIMIT',
        'SELL_LIMIT',
        'BUY_STOP',
        'SELL_STOP',
      ]

      orderTypes.forEach((orderType) => {
        const request: CreateOrderRequest = {
          ticker: 'TEST',
          orderType,
          quantity: 1,
          limitPrice: 100,
          notes: '',
          orderKind: 'entry',
        }

        const result = transformCreateOrderRequest(request)
        expect(result.order_type).toBe(orderType)
      })
    })
  })
})
