import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthProvider';
import { apiFetch } from '@/lib/apiFetch';

function Probe() {
  const auth = useAuth();
  return <div>{auth.status}:{auth.role ?? 'none'}:{auth.user?.subject ?? 'none'}</div>;
}

function renderProvider() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><Probe /></AuthProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('AuthProvider', () => {
  it('bootstraps an authenticated session', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      authenticated: true,
      user: { subject: 'u-1', email: null, display_name: 'User' },
      role: 'viewer',
      csrf_token: 'csrf',
    }), { status: 200 }))));

    renderProvider();

    expect(screen.getByText(/loading/)).toBeInTheDocument();
    await screen.findByText('authenticated:viewer:u-1');
  });

  it('moves to anonymous when the transport reports expiry', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        authenticated: true,
        user: { subject: 'u-1', email: null, display_name: 'User' },
        role: 'admin',
        csrf_token: 'csrf',
      }), { status: 200 }))
      .mockResolvedValue(new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    renderProvider();
    await screen.findByText('authenticated:admin:u-1');

    await act(async () => { await apiFetch('/api/protected'); });

    await waitFor(() => expect(screen.getByText('anonymous:none:none')).toBeInTheDocument());
  });
});
