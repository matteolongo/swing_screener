import { apiUrl } from './api';

let csrfToken: string | null = null;
let expiryEmitted = false;
const expiryListeners = new Set<() => void>();

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
  if (token !== null) expiryEmitted = false;
}

export function subscribeAuthExpired(listener: () => void): () => void {
  expiryListeners.add(listener);
  return () => expiryListeners.delete(listener);
}

export async function apiFetch(endpoint: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  const response = await fetch(apiUrl(endpoint), {
    ...init,
    method,
    headers,
    credentials: 'include',
  });
  if (response.status === 401 && !expiryEmitted) {
    expiryEmitted = true;
    expiryListeners.forEach((listener) => listener());
  }
  return response;
}
