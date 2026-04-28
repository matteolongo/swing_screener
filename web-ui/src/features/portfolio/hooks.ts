import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createOrder,
  cancelOrder,
  closePosition,
  fetchOrders,
  fetchPortfolioSummary,
  fetchPositionMetrics,
  fetchPositions,
  fetchPositionStopSuggestion,
  fetchDegiroStatus,
  fetchDegiroOrderHistory,
  fillOrder,
  fillOrderFromDegiro,
  syncDegiroOrders,
  updatePositionStop,
  OrderFilterStatus,
  PositionFilterStatus,
  DegiroStatus,
} from './api';
import {
  CreateOrderRequest,
  FillOrderRequest,
  UpdateStopRequest,
  ClosePositionRequest,
} from './types';
import { queryKeys } from '@/lib/queryKeys';
import { invalidateOrderQueries, invalidatePositionQueries } from '@/lib/queryInvalidation';

export function useOrders(status: OrderFilterStatus) {
  return useQuery({
    queryKey: queryKeys.orders(status),
    queryFn: () => fetchOrders(status),
  });
}

export function useCreateOrderMutation(onSuccess?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateOrderRequest) => createOrder(request),
    onSuccess: async () => {
      await invalidateOrderQueries(queryClient);
      onSuccess?.();
    },
  });
}

export function useFillOrderMutation(onSuccess?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, request }: { orderId: string; request: FillOrderRequest }) =>
      fillOrder(orderId, request),
    onSuccess: async () => {
      await Promise.all([
        invalidateOrderQueries(queryClient),
        invalidatePositionQueries(queryClient),
      ]);
      onSuccess?.();
    },
  });
}

export function useDegiroOrderHistory() {
  return useQuery({
    queryKey: ['degiro-order-history'] as const,
    queryFn: () => fetchDegiroOrderHistory(),
    staleTime: 2 * 60 * 1000,
  });
}

export function useFillFromDegiroMutation(onSuccess?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, degiroOrderId }: { orderId: string; degiroOrderId: string }) =>
      fillOrderFromDegiro(orderId, { degiroOrderId }),
    onSuccess: async () => {
      await invalidateOrderQueries(queryClient);
      await queryClient.invalidateQueries({ queryKey: queryKeys.positions('open') });
      onSuccess?.();
    },
  });
}

export function useCancelOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => cancelOrder(orderId),
    onSuccess: async () => {
      await invalidateOrderQueries(queryClient);
    },
  });
}

export function usePositions(status: PositionFilterStatus) {
  return useQuery({
    queryKey: queryKeys.positions(status),
    queryFn: () => fetchPositions(status),
  });
}

export function useOpenPositions() {
  return useQuery({
    queryKey: queryKeys.positions('open'),
    queryFn: () => fetchPositions('open'),
  });
}

export function usePositionMetrics(positionId?: string) {
  return useQuery({
    queryKey: queryKeys.positionMetrics(positionId),
    queryFn: () => fetchPositionMetrics(positionId as string),
    enabled: Boolean(positionId),
    staleTime: 30_000,
  });
}

export function usePortfolioSummary() {
  return useQuery({
    queryKey: queryKeys.portfolioSummary(),
    queryFn: fetchPortfolioSummary,
    staleTime: 30_000,
  });
}

export function useDegiroStatusQuery() {
  return useQuery<DegiroStatus>({
    queryKey: queryKeys.degiroStatus(),
    queryFn: fetchDegiroStatus,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useUpdateStopMutation(onSuccess?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ positionId, request }: { positionId: string; request: UpdateStopRequest }) =>
      updatePositionStop(positionId, request),
    onSuccess: async () => {
      await invalidatePositionQueries(queryClient);
      await invalidateOrderQueries(queryClient);
      onSuccess?.();
    },
  });
}

export function usePositionStopSuggestion(positionId?: string) {
  return useQuery({
    queryKey: queryKeys.positionStopSuggestion(positionId),
    queryFn: () => fetchPositionStopSuggestion(positionId as string),
    enabled: Boolean(positionId),
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export function useClosePositionMutation(onSuccess?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ positionId, request }: { positionId: string; request: ClosePositionRequest }) =>
      closePosition(positionId, request),
    onSuccess: async () => {
      await invalidatePositionQueries(queryClient);
      onSuccess?.();
    },
  });
}

export function useSyncDegiroOrdersMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncDegiroOrders,
    onSuccess: async () => {
      await Promise.all([
        invalidateOrderQueries(queryClient),
        invalidatePositionQueries(queryClient),
      ]);
    },
  });
}
