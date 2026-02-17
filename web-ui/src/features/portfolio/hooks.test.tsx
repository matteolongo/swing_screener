import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

vi.mock('@/features/portfolio/api', () => ({
  fetchOrders: vi.fn(),
  fetchOrderSnapshots: vi.fn(),
  createOrder: vi.fn(),
  fillOrder: vi.fn(),
  cancelOrder: vi.fn(),
  fetchPositions: vi.fn(),
  fetchPositionStopSuggestion: vi.fn(),
  updatePositionStop: vi.fn(),
  closePosition: vi.fn(),
}))

vi.mock('@/lib/queryInvalidation', () => ({
  invalidateOrderQueries: vi.fn(),
  invalidatePositionQueries: vi.fn(),
}))

import * as portfolioApi from '@/features/portfolio/api'
import * as queryInvalidation from '@/lib/queryInvalidation'
import {
  useCreateOrderMutation,
  useOrders,
  usePositionStopSuggestion,
  useUpdateStopMutation,
} from '@/features/portfolio/hooks'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('portfolio hooks', () => {
  const mockedFetchOrders = vi.mocked(portfolioApi.fetchOrders)
  const mockedCreateOrder = vi.mocked(portfolioApi.createOrder)
  const mockedFetchPositionStopSuggestion = vi.mocked(portfolioApi.fetchPositionStopSuggestion)
  const mockedUpdatePositionStop = vi.mocked(portfolioApi.updatePositionStop)
  const mockedInvalidateOrderQueries = vi.mocked(queryInvalidation.invalidateOrderQueries)
  const mockedInvalidatePositionQueries = vi.mocked(queryInvalidation.invalidatePositionQueries)

  beforeEach(() => {
    vi.clearAllMocks()
    mockedInvalidateOrderQueries.mockResolvedValue(undefined)
    mockedInvalidatePositionQueries.mockResolvedValue(undefined)
  })

  it('fetches orders for the selected status', async () => {
    const queryClient = createQueryClient()
    const orders = [{ orderId: 'ORD-1' }] as any
    mockedFetchOrders.mockResolvedValue(orders)

    const { result } = renderHook(() => useOrders('pending'), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockedFetchOrders).toHaveBeenCalledWith('pending')
    expect(result.current.data).toEqual(orders)
  })

  it('creates orders and invalidates order queries', async () => {
    const queryClient = createQueryClient()
    const onSuccess = vi.fn()
    const request = {
      ticker: 'AAPL',
      orderType: 'BUY_LIMIT',
      quantity: 10,
      limitPrice: 190,
    }
    mockedCreateOrder.mockResolvedValue(undefined)

    const { result } = renderHook(() => useCreateOrderMutation(onSuccess), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.mutateAsync(request)
    })

    expect(mockedCreateOrder).toHaveBeenCalledWith(request)
    expect(mockedInvalidateOrderQueries).toHaveBeenCalledWith(queryClient)
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('updates stop and invalidates both position and order queries', async () => {
    const queryClient = createQueryClient()
    const onSuccess = vi.fn()
    const payload = {
      positionId: 'POS-1',
      request: {
        newStop: 98.5,
        reason: 'trail',
      },
    }
    mockedUpdatePositionStop.mockResolvedValue(undefined)

    const { result } = renderHook(() => useUpdateStopMutation(onSuccess), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    expect(mockedUpdatePositionStop).toHaveBeenCalledWith(payload.positionId, payload.request)
    expect(mockedInvalidatePositionQueries).toHaveBeenCalledWith(queryClient)
    expect(mockedInvalidateOrderQueries).toHaveBeenCalledWith(queryClient)
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('does not fetch stop suggestions when position id is missing', async () => {
    const queryClient = createQueryClient()

    const { result } = renderHook(() => usePositionStopSuggestion(undefined), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle')
    })

    expect(mockedFetchPositionStopSuggestion).not.toHaveBeenCalled()
  })

  it('fetches stop suggestions when position id is provided', async () => {
    const queryClient = createQueryClient()
    mockedFetchPositionStopSuggestion.mockResolvedValue({
      ticker: 'AAPL',
      status: 'open',
      last: 101,
      entry: 95,
      stopOld: 92,
      stopSuggested: 97,
      shares: 10,
      rNow: 1.2,
      action: 'MOVE_STOP_UP',
      reason: 'Trend still intact',
    })

    const { result } = renderHook(() => usePositionStopSuggestion('POS-1'), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockedFetchPositionStopSuggestion).toHaveBeenCalledWith('POS-1')
    expect(result.current.data?.stopSuggested).toBe(97)
  })
})
