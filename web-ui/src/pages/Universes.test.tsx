import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'

import Universes from './Universes'
import { renderWithProviders } from '@/test/utils'
import { t } from '@/i18n/t'
import { useScreenerStore } from '@/stores/screenerStore'
import { transformScreenerResponse } from '@/features/screener/types'
import { mockScreenerResults } from '@/test/mocks/handlers'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'
import { API_BASE_URL } from '@/lib/api'
import { queryKeys } from '@/lib/queryKeys'

vi.mock('lightweight-charts')

describe('Universes page', () => {
  beforeEach(() => useScreenerStore.setState({
    lastResult: null, lastRunContext: null, todayRun: null, todayRunInitialized: true,
  }));

  it('supports roving keyboard navigation across universe detail tabs', async () => {
    const { user } = renderWithProviders(<Universes />);
    const tabs = await screen.findAllByRole('tab');
    tabs[0].focus();

    await user.keyboard('{ArrowRight}');
    expect(tabs[1]).toHaveFocus();
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{End}');
    expect(tabs[tabs.length - 1]).toHaveFocus();
    expect(tabs[tabs.length - 1]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Home}');
    expect(tabs[0]).toHaveFocus();
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('shows unpinned scan results without replacing the pinned run', async () => {
    const store = useScreenerStore.getState();
    store.recordScreenerRun({ asofDate: '2026-09-15', candidates: [], totalScreened: 0 } as never,
      { request: {}, displayFilters: { recommendedOnly: false, actionFilter: 'all' }, completedAt: 'pinned' }, true);
    const pinned = useScreenerStore.getState().todayRun;
    localStorage.setItem('screener.useForToday', 'false');
    const { user } = renderWithProviders(<Universes />);
    const section = screen.getByTestId('screener-run-section');
    await user.click(await within(section).findByRole('button', { name: t('screener.controls.run') }));
    const symbol = await within(section).findByText('AAPL');
    expect(useScreenerStore.getState().todayRun).toEqual(pinned);
    await user.click(symbol);
    expect(await screen.findByRole('dialog', {
      name: t('workspacePage.symbolDetails.title', { ticker: 'AAPL' }),
    })).toBeInTheDocument();
    expect(useScreenerStore.getState().todayRun).toEqual(pinned);
  });

  it('keeps the saved run benchmark in its symbol modal', async () => {
    useScreenerStore.getState().recordScreenerRun(
      transformScreenerResponse({ ...mockScreenerResults, candidates: mockScreenerResults.candidates.map((candidate) => ({
        ...candidate,
        price_history: candidate.price_history.map((bar) => ({ ...bar, open: bar.close - 1, high: bar.close + 1, low: bar.close - 2 })),
      })) }),
      { request: { maxPrice: 500 }, displayFilters: { recommendedOnly: false, actionFilter: 'all' } },
      false,
    );
    const { user } = renderWithProviders(<Universes />);
    await user.click(within(screen.getByTestId('screener-run-section')).getByText('AAPL'));
    const modal = await screen.findByRole('dialog', { name: t('workspacePage.symbolDetails.title', { ticker: 'AAPL' }) });
    expect(await within(modal).findByText('ACWI')).toBeVisible();
  });

  it('shares cached and refreshed fundamentals between research tabs and the canonical cache', async () => {
    let refreshes = 0;
    server.use(http.get(`${API_BASE_URL}/api/fundamentals/snapshot/AAPL`, ({ request }) => {
      if (new URL(request.url).searchParams.get('refresh') === 'true') refreshes += 1;
      if (refreshes > 1) return HttpResponse.json({ detail: 'Fundamentals source unavailable' }, { status: 503 });
      return HttpResponse.json({
        symbol: 'AAPL', asof_date: '2026-11-10', provider: 'sec_edgar', updated_at: '2026-11-10T20:00:00Z',
        instrument_type: 'equity', supported: true, coverage_status: 'supported', freshness_status: 'current',
        company_name: 'Apple Inc.', trailing_pe: refreshes ? 25 : 21,
      });
    }));
    useScreenerStore.getState().recordScreenerRun(transformScreenerResponse(mockScreenerResults),
      { request: {}, displayFilters: { recommendedOnly: false, actionFilter: 'all' } }, false);
    const { user, queryClient } = renderWithProviders(<Universes />);
    await user.click(within(screen.getByTestId('screener-run-section')).getByText('AAPL'));
    const modal = await screen.findByRole('dialog', { name: t('workspacePage.symbolDetails.title', { ticker: 'AAPL' }) });
    expect(await within(modal).findByText(t('workspacePage.overview.fundamentalsSummary', { pe: '21.0', growth: '—', margin: '—' }))).toBeVisible();
    await user.click(within(modal).getByRole('tab', { name: t('workspacePage.panels.analysis.tabs.fundamentals') }));
    await user.click(await within(modal).findByRole('button', { name: t('workspacePage.fundamentals.refresh') }));
    expect(await within(modal).findByText('25.00')).toBeVisible();
    expect(queryClient.getQueryData(queryKeys.fundamentalsSnapshot('AAPL'))).toMatchObject({ symbol: 'AAPL', trailingPe: 25 });
    await user.click(within(modal).getByRole('button', { name: t('workspacePage.fundamentals.refresh') }));
    expect(await within(modal).findByText('Fundamentals source unavailable')).toBeVisible();
    expect(within(modal).getByText('25.00')).toBeVisible();
    await user.click(within(modal).getByRole('tab', { name: t('workspacePage.panels.analysis.tabs.overview') }));
    expect(within(modal).getByText(t('workspacePage.overview.fundamentalsSummary', { pe: '25.0', growth: '—', margin: '—' }))).toBeVisible();
  });

  it('saves the selected blocked candidate as a manual draft without exposing approval', async () => {
    const candidate = { ...transformScreenerResponse(mockScreenerResults).candidates[0],
      currency: 'EUR' as const, entry: 173.09, stop: 147.97, target: 223.33, shares: 8 };
    useScreenerStore.getState().recordScreenerRun({ ...transformScreenerResponse(mockScreenerResults), candidates: [candidate] },
      { request: {}, displayFilters: { recommendedOnly: false, actionFilter: 'all' } }, false);
    let payload: Record<string, unknown> | undefined;
    server.use(http.post(`${API_BASE_URL}/api/portfolio/orders`, async ({ request }) => {
      payload = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ ...payload, order_id: 'DRAFT-RESEARCH', status: 'draft', order_date: '2026-11-11', filled_date: null });
    }));
    const { user } = renderWithProviders(<Universes />);
    await user.click(within(screen.getByTestId('screener-run-section')).getByText('AAPL'));
    const modal = await screen.findByRole('dialog', { name: t('workspacePage.symbolDetails.title', { ticker: 'AAPL' }) });
    expect(within(modal).queryByRole('tab', { name: t('workspacePage.panels.analysis.tabs.order') })).not.toBeInTheDocument();
    await user.click(within(modal).getByRole('button', { name: t('manualOrderDraft.save') }));
    const draft = await screen.findByRole('dialog', { name: t('manualOrderDraft.title', { ticker: 'AAPL' }) });
    expect(within(draft).getByLabelText(t('manualOrderDraft.entry'))).toHaveValue(173.09);
    expect(within(draft).getByLabelText(t('manualOrderDraft.currency'))).toHaveValue('EUR');
    await user.click(within(draft).getByRole('button', { name: t('manualOrderDraft.save') }));
    expect(await within(draft).findByText(t('manualOrderDraft.saved'))).toBeVisible();
    expect(payload).toMatchObject({ ticker: 'AAPL', save_as_draft: true, currency: 'EUR', quantity: 8,
      limit_price: 173.09, stop_price: 147.97, target_price: 223.33, approval_token: null });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: t('manualOrderDraft.title', { ticker: 'AAPL' }) })).not.toBeInTheDocument();
    expect(modal).toBeVisible();
    expect(useScreenerStore.getState().lastResult?.candidates[0]).toEqual(candidate);
  });

  it('distinguishes the next-run source setting from saved exploration results', async () => {
    localStorage.setItem('screener.useForToday', 'true');
    localStorage.setItem('screener-form-collapsed', 'true');
    useScreenerStore.getState().recordScreenerRun(transformScreenerResponse(mockScreenerResults),
      { request: {}, displayFilters: { recommendedOnly: false, actionFilter: 'all' } }, false);
    const { user } = renderWithProviders(<Universes />);
    const section = screen.getByTestId('screener-run-section');
    expect(within(section).getByText(t('screener.controls.useForTodayShort'))).toBeVisible();
    expect(within(section).getByText(t('screener.summary.notTodaySource'))).toBeVisible();
    await user.click(within(section).getByRole('button', { name: t('screener.summary.useForToday') }));
    expect(within(section).queryByText(t('screener.summary.notTodaySource'))).not.toBeInTheDocument();
    expect(useScreenerStore.getState().todayRun?.result).toEqual(useScreenerStore.getState().lastResult);
  });

  it('runs live symbol discovery and shows taxonomy plus candidates', async () => {
    const { user } = renderWithProviders(<Universes />)

    await user.click(screen.getByRole('tab', { name: 'Discovery' }))
    await user.click(screen.getByRole('button', { name: t('universesPage.discovery.discoverSymbols') }))

    expect(await screen.findByText('NVDA')).toBeInTheDocument()
    expect(screen.getByText('NVIDIA Corporation')).toBeInTheDocument()
    expect(screen.getByText(t('universesPage.discovery.candidates', { count: '1' }))).toBeInTheDocument()

    expect(screen.getByText('USD 1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: t('universesPage.discovery.runScreener') }))

    expect(await screen.findByText(t('universesPage.discovery.screener.title'))).toBeInTheDocument()
    expect(screen.getByText(t('universesPage.discovery.columns.nextAction'))).toBeInTheDocument()
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText(t('universesPage.discovery.screener.screenedCount', { count: '500' }))).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.queryByText(t('universesPage.discovery.discovering'))).not.toBeInTheDocument()
    })
  })

  it('opens the symbol detail modal when a screener result row is clicked', async () => {
    const { user } = renderWithProviders(<Universes />)

    await user.click(screen.getByRole('tab', { name: 'Discovery' }))
    await user.click(screen.getByRole('button', { name: t('universesPage.discovery.discoverSymbols') }))
    await screen.findByText('NVDA')
    await user.click(screen.getByRole('button', { name: t('universesPage.discovery.runScreener') }))
    await screen.findByText(t('universesPage.discovery.screener.title'))

    await user.click(screen.getByText('AAPL'))

    expect(await screen.findByText('AAPL Details')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: t('workspacePage.panels.analysis.tabs.order') })).not.toBeInTheDocument()
  })

  it('selects a screener candidate with the keyboard', async () => {
    const { user } = renderWithProviders(<Universes />)

    await user.click(screen.getByRole('tab', { name: 'Discovery' }))
    await user.click(screen.getByRole('button', { name: t('universesPage.discovery.discoverSymbols') }))
    await screen.findByText('NVDA')
    await user.click(screen.getByRole('button', { name: t('universesPage.discovery.runScreener') }))
    await screen.findByText(t('universesPage.discovery.screener.title'))

    const candidateButton = screen.getByRole('button', { name: /AAPL/ })
    candidateButton.focus()
    await user.keyboard('{Enter}')

    expect(candidateButton.closest('tr')).toHaveAttribute('aria-selected', 'true')
  })

  it('exposes the screener run form and feeds todayRun/lastResult on completion', async () => {
    useScreenerStore.setState({
      lastResult: null,
      lastRunContext: null,
      todayRun: null,
      todayRunInitialized: true,
    })
    const { user } = renderWithProviders(<Universes />)

    const section = screen.getByTestId('screener-run-section')
    expect(section).toHaveTextContent(t('universesPage.screenerRun.title'))
    const runButton = await within(section).findByRole('button', { name: t('screener.controls.run') })
    expect(runButton).toBeInTheDocument()

    await user.click(runButton)

    await waitFor(() => {
      expect(useScreenerStore.getState().lastResult).not.toBeNull()
    })
    const todayRun = useScreenerStore.getState().todayRun
    expect(todayRun).not.toBeNull()
    expect(todayRun?.result.candidates).toHaveLength(1)
    expect(todayRun?.result.candidates[0].ticker).toBe('AAPL')
  })
})
