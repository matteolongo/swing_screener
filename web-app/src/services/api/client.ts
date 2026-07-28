import type { ApiError } from '@/types/api';

export function createApiClient(baseUrl?: string) {
  const url = baseUrl || import.meta.env.VITE_API_URL || 'http://localhost:8000';

  async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${url}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      credentials: 'include',
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw { ...err, status: res.status } as ApiError;
    }
    return res.json();
  }

  return {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body?: unknown) =>
      request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
    put: <T>(path: string, body?: unknown) =>
      request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
    del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  };
}
