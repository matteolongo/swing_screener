import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import { AuthProvider } from './AuthProvider';
import { LoginGate } from './LoginGate';

afterEach(() => { vi.unstubAllGlobals(); });

it('shows OIDC login while anonymous and children while authenticated', async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(
    JSON.stringify({ authenticated: false }), { status: 200 },
  ))));
  const client = new QueryClient();
  const first = render(
    <QueryClientProvider client={client}>
      <AuthProvider><LoginGate><div>Private app</div></LoginGate></AuthProvider>
    </QueryClientProvider>,
  );
  expect(await screen.findByRole('link', { name: /sign in/i })).toHaveAttribute(
    'href',
    apiUrl(API_ENDPOINTS.authLogin),
  );
  expect(screen.queryByText('Private app')).not.toBeInTheDocument();
  first.unmount();

  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({
    authenticated: true,
    user: { subject: 'u-1', email: null, display_name: 'User' },
    role: 'viewer',
    csrf_token: 'csrf',
  }), { status: 200 }))));
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><LoginGate><div>Private app</div></LoginGate></AuthProvider>
    </QueryClientProvider>,
  );
  expect(await screen.findByText('Private app')).toBeInTheDocument();
});
