import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import {
  CreateOrderRequest,
  FillOrderRequest,
  Order,
  OrderStatus,
  OrderSnapshot,
  OrderSnapshotResponseApi,
  Position,
  PositionStatus,
  UpdateStopRequest,
  ClosePositionRequest,
  transformOrder,
  transformCreateOrderRequest,
  transformOrderSnapshot,
  transformPosition,
} from './types';

export type OrderFilterStatus = OrderStatus | 'all';
export type PositionFilterStatus = PositionStatus | 'all';

export async function fetchOrders(status: OrderFilterStatus): Promise<Order[]> {
  const params = status !== 'all' ? `?status=${status}` : '';
  const response = await fetch(apiUrl(API_ENDPOINTS.orders + params));
  if (!response.ok) throw new Error('Failed to fetch orders');
  const data = await response.json();
  return data.orders.map(transformOrder);
}

export async function fetchOrderSnapshots(): Promise<{ orders: OrderSnapshot[]; asof: string }> {
  const response = await fetch(apiUrl(API_ENDPOINTS.ordersSnapshot));
  if (!response.ok) throw new Error('Failed to fetch order snapshots');
  const data: OrderSnapshotResponseApi = await response.json();
  return {
    orders: data.orders.map(transformOrderSnapshot),
    asof: data.asof,
  };
}

export async function createOrder(request: CreateOrderRequest): Promise<void> {
  const response = await fetch(apiUrl(API_ENDPOINTS.orders), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transformCreateOrderRequest(request)),
  });
  if (!response.ok) throw new Error('Failed to create order');
}

export async function fillOrder(orderId: string, request: FillOrderRequest): Promise<void> {
  const payload: Record<string, number | string> = {
    filled_price: request.filledPrice,
    filled_date: request.filledDate,
  };
  if (request.stopPrice && request.stopPrice > 0) {
    payload.stop_price = request.stopPrice;
  }

  const response = await fetch(apiUrl(API_ENDPOINTS.orderFill(orderId)), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('Failed to fill order');
}

export async function cancelOrder(orderId: string): Promise<void> {
  const response = await fetch(apiUrl(API_ENDPOINTS.order(orderId)), {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to cancel order');
}

export async function fetchPositions(status: PositionFilterStatus): Promise<Position[]> {
  const params = status !== 'all' ? `?status=${status}` : '';
  const response = await fetch(apiUrl(API_ENDPOINTS.positions + params));
  if (!response.ok) throw new Error('Failed to fetch positions');
  const data = await response.json();
  return data.positions.map(transformPosition);
}

export async function updatePositionStop(
  positionId: string,
  request: UpdateStopRequest,
): Promise<void> {
  const response = await fetch(apiUrl(API_ENDPOINTS.positionStop(positionId)), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      new_stop: request.newStop,
      reason: request.reason || '',
    }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update stop');
  }
}

export async function closePosition(
  positionId: string,
  request: ClosePositionRequest,
): Promise<void> {
  const response = await fetch(apiUrl(API_ENDPOINTS.positionClose(positionId)), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      exit_price: request.exitPrice,
      reason: request.reason || '',
    }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to close position');
  }
}
