import type {
  OrdersResponse,
  PositionsResponse,
  PreviewRequest,
  PreviewDiff,
  ScreeningRequest,
  ScreeningResponse,
} from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}

export function getOrders(): Promise<OrdersResponse> {
  return request('/orders');
}

export function getPositions(): Promise<PositionsResponse> {
  return request('/positions');
}

export function previewChanges(payload: PreviewRequest): Promise<PreviewDiff> {
  return request('/preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function applyChanges(payload: PreviewRequest): Promise<{ success: boolean; asof: string }>{
  return request('/apply', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function runScreening(payload: ScreeningRequest): Promise<ScreeningResponse> {
  return request('/screening/run', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
