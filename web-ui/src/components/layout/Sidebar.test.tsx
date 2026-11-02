import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/i18n/I18nProvider';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import Sidebar from './Sidebar';
import MainLayout from './MainLayout';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { API_BASE_URL } from '@/lib/api';

function mockDesktop(matches: boolean) {
  const media = Object.assign(new EventTarget(), { matches, media: '(min-width: 1024px)' });
  vi.stubGlobal('matchMedia', () => media);
  return (desktop: boolean) => {
    media.matches = desktop;
    act(() => { media.dispatchEvent(new Event('change')); });
  };
}

function renderLayout() {
  useOnboardingStore.setState({ status: 'completed' });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  // happy-dom's browser history methods are no-ops; use the real memory router for route assertions.
  return renderWithProviders(<AuthProvider><MainLayout /><RouteLocation /></AuthProvider>, {
    queryClient,
    wrapper: ({ children }) => (
      <I18nProvider><QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/today']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          {children}
        </MemoryRouter>
      </QueryClientProvider></I18nProvider>
    ),
  });
}

function RouteLocation() {
  return <output data-testid="route-location">{useLocation().pathname}</output>;
}

function renderSidebar() {
  return renderWithProviders(<Sidebar />);
}


describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.clear();
    mockDesktop(true);
    server.use(http.get(`${API_BASE_URL}/api/auth/session`, () => HttpResponse.json({
      authenticated: true, role: 'viewer', csrf_token: 'csrf',
      user: { subject: 'test-user', name: 'Test User', email: 'test@example.com' },
    })));
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it('should render primary navigation items', () => {
    renderWithProviders(<Sidebar />);

    expect(screen.getByRole('link', { name: t('sidebar.nav.today') })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('sidebar.nav.book') })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('sidebar.nav.settings') })).toBeInTheDocument();
  });

  it('should not show old navigation items removed in revamp', () => {
    renderWithProviders(<Sidebar />);

    expect(screen.queryByRole('link', { name: t('sidebar.nav.workspace') })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: t('sidebar.nav.dailyReview') })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: t('sidebar.nav.fundamentals') })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: t('sidebar.nav.journal') })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: t('sidebar.nav.analytics') })).not.toBeInTheDocument();
  });

  it('should not show strategy selector (moved to header)', () => {
    renderWithProviders(<Sidebar />);

    expect(screen.queryByText(t('sidebar.activeStrategy'))).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('groups secondary pages under a collapsed Avanzate section', () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: t('sidebar.nav.today') })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('sidebar.nav.book') })).toBeInTheDocument();
    const advanced = screen.getByText(t('sidebar.nav.advanced'));
    expect(advanced).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('sidebar.nav.universes') })).toBeInTheDocument();
  });

  it('opens from the real header and restores focus and scroll on Escape', async () => {
    mockDesktop(false);
    const previousOverflow = document.body.style.overflow;
    const { user } = renderLayout();
    const trigger = screen.getByRole('button', { name: t('header.showNavigation') });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const navigation = screen.getByRole('navigation');
    expect(navigation).toHaveAttribute('id', trigger.getAttribute('aria-controls'));
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(document.body.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(document.body.style.overflow).toBe(previousOverflow);
  });

  it.each([
    ['sidebar.nav.today', '/today'],
    ['sidebar.nav.book', '/book'],
    ['sidebar.nav.universes', '/universes'],
    ['sidebar.nav.settings', '/strategy'],
  ] as const)('navigates to %s and closes the drawer', async (key, path) => {
    mockDesktop(false);
    const { user } = renderLayout();
    const trigger = screen.getByRole('button', { name: t('header.showNavigation') });
    await user.click(trigger);
    if (key === 'sidebar.nav.universes') await user.click(screen.getByText(t('sidebar.nav.advanced')));
    await user.click(screen.getByRole('link', { name: t(key) }));
    await waitFor(() => expect(screen.getByTestId('route-location')).toHaveTextContent(path));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes with the labelled button and on a transition to desktop', async () => {
    const resize = mockDesktop(false);
    const { user } = renderLayout();
    const trigger = screen.getByRole('button', { name: t('header.showNavigation') });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: t('header.hideNavigation') }));
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    resize(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(document.body.style.overflow).not.toBe('hidden');
    resize(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('header.showNavigation') })).toHaveAttribute('aria-expanded', 'false');
  });
});
