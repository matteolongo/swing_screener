import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import Backtest from './Backtest'

describe('Backtest Page', () => {
  it('renders backtest title and parameters card', () => {
    renderWithProviders(<Backtest />)
    expect(screen.getByText('Backtest')).toBeInTheDocument()
    expect(screen.getByText('Backtest Parameters')).toBeInTheDocument()
    expect(screen.getByLabelText('Invested Budget (optional)')).toBeInTheDocument()
  })

  it('loads saved simulations list', async () => {
    renderWithProviders(<Backtest />)

    await waitFor(() => {
      expect(
        screen.getByText(/2026-02-08 22:30 • AAPL, MSFT • auto/i)
      ).toBeInTheDocument()
    })
  })

  it('runs a backtest and shows summary', async () => {
    const { user } = renderWithProviders(<Backtest />)

    const tickersInput = screen.getByPlaceholderText('AAPL, MSFT, NVDA')
    await user.clear(tickersInput)
    await user.type(tickersInput, 'AAPL, MSFT')

    const runButton = screen.getByRole('button', { name: /Run Backtest/i })
    await waitFor(() => {
      expect(runButton).not.toBeDisabled()
    })
    await user.click(runButton)

    await waitFor(() => {
      expect(screen.getByText('+0.75R')).toBeInTheDocument()
    })
  })
})
