import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'

import Universes from './Universes'
import { renderWithProviders } from '@/test/utils'
import { t } from '@/i18n/t'
import { useScreenerStore } from '@/stores/screenerStore'

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

  it('runs live symbol discovery and shows taxonomy plus candidates', async () => {
    const { user } = renderWithProviders(<Universes />)

    await user.click(screen.getByRole('tab', { name: 'Discovery' }))
    await user.click(screen.getByRole('button', { name: t('universesPage.discovery.discoverSymbols') }))

    expect(await screen.findByText('NVDA')).toBeInTheDocument()
    expect(screen.getByText('NVIDIA Corporation')).toBeInTheDocument()
    expect(screen.getByText(t('universesPage.discovery.candidates', { count: '1' }))).toBeInTheDocument()

    expect(screen.getByText('USD 1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: t('universesPage.discovery.runScreener') }))

    expect(await screen.findByText('Screener Results for Discovered Symbols')).toBeInTheDocument()
    expect(screen.getByText(t('universesPage.discovery.columns.nextAction'))).toBeInTheDocument()
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('500 screened')).toBeInTheDocument()

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
    await screen.findByText('Screener Results for Discovered Symbols')

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
    await screen.findByText('Screener Results for Discovered Symbols')

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
