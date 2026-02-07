// Order types matching backend API models

export type OrderStatus = 'pending' | 'filled' | 'cancelled';
export type OrderKind = 'entry' | 'stop' | 'take_profit';

export interface Order {
  orderId: string;
  ticker: string;
  status: OrderStatus;
  orderType: string;
  quantity: number;
  limitPrice: number | null;
  stopPrice: number | null;
  orderDate: string;
  filledDate: string;
  entryPrice: number | null;
  notes: string;
  orderKind: OrderKind | null;
  parentOrderId: string | null;
  positionId: string | null;
  tif: string | null;
}

export interface CreateOrderRequest {
  ticker: string;
  orderType: string;
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
  notes?: string;
  orderKind?: OrderKind;
}

export interface FillOrderRequest {
  filledPrice: number;
  filledDate: string;
}

// Backend uses snake_case, transform to camelCase
export interface OrderApiResponse {
  order_id: string;
  ticker: string;
  status: OrderStatus;
  order_type: string;
  quantity: number;
  limit_price: number | null;
  stop_price: number | null;
  order_date: string;
  filled_date: string;
  entry_price: number | null;
  notes: string;
  order_kind: OrderKind | null;
  parent_order_id: string | null;
  position_id: string | null;
  tif: string | null;
}

export function transformOrder(apiOrder: OrderApiResponse): Order {
  return {
    orderId: apiOrder.order_id,
    ticker: apiOrder.ticker,
    status: apiOrder.status,
    orderType: apiOrder.order_type,
    quantity: apiOrder.quantity,
    limitPrice: apiOrder.limit_price,
    stopPrice: apiOrder.stop_price,
    orderDate: apiOrder.order_date,
    filledDate: apiOrder.filled_date,
    entryPrice: apiOrder.entry_price,
    notes: apiOrder.notes,
    orderKind: apiOrder.order_kind,
    parentOrderId: apiOrder.parent_order_id,
    positionId: apiOrder.position_id,
    tif: apiOrder.tif,
  };
}

export function transformCreateOrderRequest(req: CreateOrderRequest): any {
  return {
    ticker: req.ticker,
    order_type: req.orderType,
    quantity: req.quantity,
    limit_price: req.limitPrice,
    stop_price: req.stopPrice,
    notes: req.notes || '',
    order_kind: req.orderKind || 'entry',
  };
}
