import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { queryKeys } from '@/lib/queryKeys'

vi.mock('@/features/intelligence/api', () => ({
  fetchIntelligenceOpportunities: vi.fn(),
  fetchIntelligenceRunStatus: vi.fn(),
  runIntelligence: vi.fn(),
}))

import * as intelligenceApi from '@/features/intelligence/api'
import {
  useIntelligenceOpportunitiesScoped,
  useIntelligenceRunStatus,
  useRunIntelligenceMutation,
} from '@/features/intelligence/hooks'

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

describe('intelligence hooks', () => {
  const mockedRunIntelligence = vi.mocked(intelligenceApi.runIntelligence)
  const mockedFetchIntelligenceRunStatus = vi.mocked(intelligenceApi.fetchIntelligenceRunStatus)
  const mockedFetchIntelligenceOpportunities = vi.mocked(intelligenceApi.fetchIntelligenceOpportunities)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs intelligence and invalidates opportunities queries', async () => {
    const queryClient = createQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const launchResponse = {
      jobId: 'job-1',
      status: 'queued' as const,
      totalSymbols: 2,
      createdAt: '2026-02-15T20:00:00',
      updatedAt: '2026-02-15T20:00:00',
    }
    const onSuccess = vi.fn()
    mockedRunIntelligence.mockResolvedValue(launchResponse)

    const { result } = renderHook(() => useRunIntelligenceMutation(onSuccess), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.mutateAsync({ symbols: ['AAPL', 'MSFT'] })
    })

    expect(mockedRunIntelligence).toHaveBeenCalledWith({ symbols: ['AAPL', 'MSFT'] })
    expect(invalidateSpy).toHaveBeenCalled()
    const invalidationFilter = invalidateSpy.mock.calls[0]?.[0]
    expect(invalidationFilter).toBeDefined()

    if (invalidationFilter && 'predicate' in invalidationFilter) {
      const predicate = invalidationFilter.predicate as unknown as (query: {
        queryKey: unknown[]
      }) => boolean
      expect(predicate({ queryKey: ['intelligence-opportunities'] })).toBe(true)
      expect(predicate({ queryKey: ['orders'] })).toBe(false)
    }
    expect(onSuccess).toHaveBeenCalledWith(launchResponse)
  })

  it('does not fetch run status when job id is missing', async () => {
    const queryClient = createQueryClient()

    const { result } = renderHook(() => useIntelligenceRunStatus(undefined), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle')
    })

    expect(mockedFetchIntelligenceRunStatus).not.toHaveBeenCalled()
  })

  it('fetches run status and polls while run is active', async () => {
    const queryClient = createQueryClient()
    mockedFetchIntelligenceRunStatus.mockResolvedValue({
      jobId: 'job-2',
      status: 'running',
      totalSymbols: 10,
      completedSymbols: 3,
      asofDate: '2026-02-15',
      opportunitiesCount: 1,
      error: undefined,
      createdAt: '2026-02-15T20:00:00',
      updatedAt: '2026-02-15T20:00:04',
    })

    const { result } = renderHook(() => useIntelligenceRunStatus('job-2'), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockedFetchIntelligenceRunStatus).toHaveBeenCalledWith('job-2')

    const query = queryClient.getQueryCache().find({
      queryKey: queryKeys.intelligenceRunStatus('job-2'),
    }) as any
    const refetchInterval = query?.options?.refetchInterval as ((queryArg: any) => number | false) | undefined
    expect(typeof refetchInterval).toBe('function')
    expect(refetchInterval?.(query)).toBe(2500)
  })

  it('stops polling when run status is completed', async () => {
    const queryClient = createQueryClient()
    mockedFetchIntelligenceRunStatus.mockResolvedValue({
      jobId: 'job-3',
      status: 'completed',
      totalSymbols: 10,
      completedSymbols: 10,
      asofDate: '2026-02-15',
      opportunitiesCount: 3,
      error: undefined,
      createdAt: '2026-02-15T20:00:00',
      updatedAt: '2026-02-15T20:00:08',
    })

    const { result } = renderHook(() => useIntelligenceRunStatus('job-3'), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    const query = queryClient.getQueryCache().find({
      queryKey: queryKeys.intelligenceRunStatus('job-3'),
    }) as any
    const refetchInterval = query?.options?.refetchInterval as ((queryArg: any) => number | false) | undefined
    expect(refetchInterval?.(query)).toBe(false)
  })

  it('normalizes symbol scope when fetching opportunities', async () => {
    const queryClient = createQueryClient()
    mockedFetchIntelligenceOpportunities.mockResolvedValue({
      asofDate: '2026-02-15',
      opportunities: [],
    })

    const { result } = renderHook(
      () => useIntelligenceOpportunitiesScoped('2026-02-15', [' aapl ', '', 'MsFt ']),
      { wrapper: createWrapper(queryClient) }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockedFetchIntelligenceOpportunities).toHaveBeenCalledWith('2026-02-15', ['AAPL', 'MSFT'])

    const query = queryClient.getQueryCache().find({
      queryKey: queryKeys.intelligenceOpportunities('2026-02-15', 'AAPL,MSFT'),
    })
    expect(query).toBeDefined()
  })

  it('respects disabled opportunities queries', async () => {
    const queryClient = createQueryClient()

    const { result } = renderHook(
      () => useIntelligenceOpportunitiesScoped('2026-02-15', ['AAPL'], false),
      { wrapper: createWrapper(queryClient) }
    )

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle')
    })

    expect(mockedFetchIntelligenceOpportunities).not.toHaveBeenCalled()
  })
})
