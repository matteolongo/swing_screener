import { apiUrl } from './api';

let csrfToken: string | null = null;
let expiryEmitted = false;
const expiryListeners = new Set<() => void>();

export interface ApiFetchInit extends RequestInit {
  expireAuthOnUnauthorized?: boolean;
}

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
  if (token !== null) expiryEmitted = false;
}

export function subscribeAuthExpired(listener: () => void): () => void {
  expiryListeners.add(listener);
  return () => expiryListeners.delete(listener);
}

export async function apiFetch(endpoint: string, init: ApiFetchInit = {}): Promise<Response> {
  const { expireAuthOnUnauthorized = true, ...requestInit } = init;
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(requestInit.headers);
  if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  const response = await fetch(apiUrl(endpoint), {
    ...requestInit,
    method,
    headers,
    credentials: 'include',
  });
  if (response.status === 401 && expireAuthOnUnauthorized && !expiryEmitted) {
    expiryEmitted = true;
    expiryListeners.forEach((listener) => listener());
  }
  return response;
}
