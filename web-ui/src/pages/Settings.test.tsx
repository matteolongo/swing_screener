import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import Settings from './Settings'

describe('Settings Page', () => {
  it('renders settings page title', () => {
    renderWithProviders(<Settings />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders all configuration sections', () => {
    renderWithProviders(<Settings />)
    expect(screen.getByText(/Account & Risk Management/i)).toBeInTheDocument()
    expect(screen.getByText(/Technical Indicators/i)).toBeInTheDocument()
    expect(screen.getByText(/Position Management Rules/i)).toBeInTheDocument()
  })

  it('renders reset button', () => {
    renderWithProviders(<Settings />)
    expect(screen.getByRole('button', { name: /Reset to Defaults/i })).toBeInTheDocument()
  })

  it('reset button is clickable', async () => {
    const { user } = renderWithProviders(<Settings />)
    const resetButton = screen.getByRole('button', { name: /Reset to Defaults/i })
    expect(resetButton).not.toBeDisabled()
    await user.click(resetButton)
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('displays number inputs for configuration', () => {
    renderWithProviders(<Settings />)
    const numberInputs = screen.queryAllByRole('spinbutton')
    expect(numberInputs.length).toBeGreaterThan(5)
  })

  it('all sections are rendered in cards', () => {
    renderWithProviders(<Settings />)
    expect(screen.getByText(/Account & Risk Management/i)).toBeInTheDocument()
    expect(screen.getByText(/Technical Indicators/i)).toBeInTheDocument()
    expect(screen.getByText(/Position Management Rules/i)).toBeInTheDocument()
  })

  it('page renders without errors', () => {
    renderWithProviders(<Settings />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })
})
