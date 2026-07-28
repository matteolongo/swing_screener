import { apiFetch } from './apiFetch';

export class ApiHttpError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
    this.code = code;
  }
}

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
  const response = await apiFetch(endpoint, requestInit);

  if (!response.ok) {
    let detail: string | undefined;
    let code: string | null = null;
    try {
      const body = await response.json();
      code = typeof body?.code === 'string'
        ? body.code
        : typeof body?.detail?.code === 'string'
          ? body.detail.code
          : null;
      detail = typeof body?.detail === 'string'
        ? body.detail
        : typeof body?.detail?.message === 'string'
          ? body.detail.message
          : undefined;
    } catch {
      // non-JSON error body; fall through to errorMessage/status
    }
    throw new ApiHttpError(
      detail || errorMessage || `Request failed with status ${response.status}`,
      response.status,
      code,
    );
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
