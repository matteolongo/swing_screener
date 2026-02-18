import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createOrder,
  cancelOrder,
  closePosition,
  fetchOrderSnapshots,
  fetchOrders,
  fetchPortfolioSummary,
  fetchPositionMetrics,
  fetchPositions,
  fetchPositionStopSuggestion,
  fillOrder,
  updatePositionStop,
  OrderFilterStatus,
  PositionFilterStatus,
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

export function useOrderSnapshots() {
  return useQuery({
    queryKey: queryKeys.ordersSnapshot(),
    queryFn: fetchOrderSnapshots,
    refetchOnWindowFocus: false,
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
      await invalidateOrderQueries(queryClient);
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
