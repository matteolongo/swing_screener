import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createOrder,
  cancelOrder,
  closePosition,
  fetchOrderSnapshots,
  fetchOrders,
  fetchPositions,
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

export function useOrders(status: OrderFilterStatus) {
  return useQuery({
    queryKey: ['orders', status],
    queryFn: () => fetchOrders(status),
  });
}

export function useOrderSnapshots() {
  return useQuery({
    queryKey: ['orders', 'snapshot'],
    queryFn: fetchOrderSnapshots,
    refetchOnWindowFocus: false,
  });
}

export function useCreateOrderMutation(onSuccess?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateOrderRequest) => createOrder(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onSuccess?.();
    },
  });
}

export function useFillOrderMutation(onSuccess?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, request }: { orderId: string; request: FillOrderRequest }) =>
      fillOrder(orderId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onSuccess?.();
    },
  });
}

export function useCancelOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => cancelOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function usePositions(status: PositionFilterStatus) {
  return useQuery({
    queryKey: ['positions', status],
    queryFn: () => fetchPositions(status),
  });
}

export function useOpenPositions() {
  return useQuery({
    queryKey: ['positions', 'open'],
    queryFn: () => fetchPositions('open'),
  });
}

export function useUpdateStopMutation(onSuccess?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ positionId, request }: { positionId: string; request: UpdateStopRequest }) =>
      updatePositionStop(positionId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      onSuccess?.();
    },
  });
}

export function useClosePositionMutation(onSuccess?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ positionId, request }: { positionId: string; request: ClosePositionRequest }) =>
      closePosition(positionId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      onSuccess?.();
    },
  });
}
