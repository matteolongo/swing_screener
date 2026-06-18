import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

import Universes from './Universes'
import { renderWithProviders } from '@/test/utils'

describe('Universes page', () => {
  it('runs live symbol discovery and shows taxonomy plus candidates', async () => {
    const { user } = renderWithProviders(<Universes />)

    await user.click(screen.getByRole('button', { name: 'Discovery' }))
    await user.click(screen.getByRole('button', { name: /discover symbols/i }))

    expect(await screen.findByText('NVDA')).toBeInTheDocument()
    expect(screen.getByText('NVIDIA Corporation')).toBeInTheDocument()
    expect(screen.getByText('1 candidates')).toBeInTheDocument()

    expect(screen.getByText('USD 1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /run screener on these symbols/i }))

    expect(await screen.findByText('Screener Results for Discovered Symbols')).toBeInTheDocument()
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('500 screened')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.queryByText('Discovering…')).not.toBeInTheDocument()
    })
  })

  it('opens the symbol detail modal when a screener result row is clicked', async () => {
    const { user } = renderWithProviders(<Universes />)

    await user.click(screen.getByRole('button', { name: 'Discovery' }))
    await user.click(screen.getByRole('button', { name: /discover symbols/i }))
    await screen.findByText('NVDA')
    await user.click(screen.getByRole('button', { name: /run screener on these symbols/i }))
    await screen.findByText('Screener Results for Discovered Symbols')

    await user.click(screen.getByText('AAPL'))

    expect(await screen.findByText('AAPL Details')).toBeInTheDocument()
  })
})
