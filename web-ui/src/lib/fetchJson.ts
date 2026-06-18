import { apiUrl } from './api';

export interface FetchJsonInit extends RequestInit {
  /** Fallback error message when the response has no `detail` field. */
  errorMessage?: string;
}

/**
 * Thin wrapper around fetch for the JSON API: prefixes the base URL, throws a
 * useful Error on non-2xx (preferring the backend's `detail`, then a caller
 * `errorMessage`, then the status), and tolerates empty (204) bodies.
 * Single source for the request/error boilerplate the feature api.ts files share.
 */
export async function fetchJson<T>(endpoint: string, init: FetchJsonInit = {}): Promise<T> {
  const { errorMessage, ...requestInit } = init;
  const response = await fetch(apiUrl(endpoint), requestInit);

  if (!response.ok) {
    let detail: string | undefined;
    try {
      const body = await response.json();
      detail = body?.detail;
    } catch {
      // non-JSON error body; fall through to errorMessage/status
    }
    throw new Error(detail || errorMessage || `Request failed with status ${response.status}`);
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
