import type {
  OrdersResponse,
  PositionsResponse,
  PreviewRequest,
  PreviewDiff,
  ScreeningRequest,
  ScreeningResponse,
  UniversesResponse,
} from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers || {});
  const hasBody = options?.body !== undefined && options?.body !== null;

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const fallback = `Request failed (${res.status})`;
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/json')) {
      const payload = await res.json().catch(() => null);
      const detail = payload && typeof payload === 'object' ? (payload as { detail?: unknown }).detail : undefined;
      if (typeof detail === 'string' && detail.trim()) {
        throw new Error(detail);
      }
      throw new Error(fallback);
    }
    const text = await res.text();
    throw new Error(text || fallback);
  }

  return res.json() as Promise<T>;
}

export function getOrders(): Promise<OrdersResponse> {
  return request('/orders');
}

export function getPositions(): Promise<PositionsResponse> {
  return request('/positions');
}

export function getUniverses(): Promise<UniversesResponse> {
  return request('/universes');
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
