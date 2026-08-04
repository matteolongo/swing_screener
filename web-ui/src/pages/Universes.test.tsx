import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

import Universes from './Universes'
import { renderWithProviders } from '@/test/utils'
import { t } from '@/i18n/t'

describe('Universes page', () => {
  it('runs live symbol discovery and shows taxonomy plus candidates', async () => {
    const { user } = renderWithProviders(<Universes />)

    await user.click(screen.getByRole('button', { name: 'Discovery' }))
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

    await user.click(screen.getByRole('button', { name: 'Discovery' }))
    await user.click(screen.getByRole('button', { name: t('universesPage.discovery.discoverSymbols') }))
    await screen.findByText('NVDA')
    await user.click(screen.getByRole('button', { name: t('universesPage.discovery.runScreener') }))
    await screen.findByText('Screener Results for Discovered Symbols')

    await user.click(screen.getByText('AAPL'))

    expect(await screen.findByText('AAPL Details')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: t('workspacePage.panels.analysis.tabs.order') })).not.toBeInTheDocument()
  })
})
