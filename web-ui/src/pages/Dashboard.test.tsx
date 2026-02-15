import { describe, it, expect, beforeEach } from 'vitest'
import { screen, waitFor, act } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import Dashboard from './Dashboard'
import { useConfigStore } from '@/stores/configStore'
import { DEFAULT_CONFIG } from '@/types/config'

describe('Dashboard Page', () => {
  beforeEach(() => {
    // Reset config store to defaults
    useConfigStore.setState({
      config: DEFAULT_CONFIG,
    })
  })

  describe('Page Structure', () => {
    it('renders dashboard title', async () => {
      renderWithProviders(<Dashboard />)
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      await screen.findByText('Portfolio Summary')
    })

    it('renders all main sections', async () => {
      renderWithProviders(<Dashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Portfolio Summary')).toBeInTheDocument()
        expect(screen.getByText('Strategy Coach')).toBeInTheDocument()
        expect(screen.getByText('Market Intelligence')).toBeInTheDocument()
        expect(screen.getByText('Priority Actions')).toBeInTheDocument()
        // Getting Started should not be visible when there are no positions/orders
        // Daily Routine and large Quick Actions removed
        // Open Orders Snapshot merged into Priority Actions
      })
    })
  })

  describe('Market Intelligence', () => {
    it('renders intelligence card with run action', async () => {
      renderWithProviders(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('Market Intelligence')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Run Intelligence/i })).toBeInTheDocument()
      })
    })

    it('runs intelligence and renders opportunities', async () => {
      const { user } = renderWithProviders(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Run Intelligence/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /Run Intelligence/i }))

      await waitFor(() => {
        expect(screen.getByText('Run complete: 1/1 symbols analyzed, 1 opportunities found.')).toBeInTheDocument()
        expect(screen.getByText('Opportunities (as of 2026-02-15)')).toBeInTheDocument()
      })

      await screen.findByText('Catalyst + follow-through confirmed.')
      expect(screen.getByText('Technical 82.0% | Catalyst 71.0%')).toBeInTheDocument()
    })
  })

  describe('Strategy Coach', () => {
    it('renders strategy coach card collapsed by default', async () => {
      renderWithProviders(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('Strategy Coach')).toBeInTheDocument()
        expect(screen.getByText(/Active:/i)).toBeInTheDocument()
        expect(screen.getByText('Default')).toBeInTheDocument()
        // Strategy coach is collapsed by default, so formulas shouldn't be visible initially
        expect(screen.queryByText(/Stop = Entry - \(2.0 x ATR\(14\)\)/i)).not.toBeInTheDocument()
      })
    })

    it('falls back to local config explanation if active strategy query fails', async () => {
      const { server } = await import('@/test/mocks/server')
      const { http, HttpResponse } = await import('msw')

      server.use(
        http.get('*/api/strategy/active', () => HttpResponse.json({ detail: 'boom' }, { status: 500 }))
      )

      renderWithProviders(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('Strategy Coach')).toBeInTheDocument()
        expect(screen.getByText(/Using local Settings values because active strategy data could not be loaded/i)).toBeInTheDocument()
      })
    })
  })

  describe('Portfolio Summary', () => {
    it('displays account size from active strategy', async () => {
      renderWithProviders(<Dashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Account Size')).toBeInTheDocument()
        expect(screen.getByText('$50,000.00')).toBeInTheDocument()
      })
    })

    it('displays open positions count', async () => {
      renderWithProviders(<Dashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Open Positions')).toBeInTheDocument()
        // MSW mock returns 1 open position (VALE)
        const container = screen.getByText('Open Positions').closest('div')
        expect(container).toHaveTextContent('1')
      })
    })

    it('calculates position value correctly', async () => {
      renderWithProviders(<Dashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Position Value')).toBeInTheDocument()
        // VALE: 6 shares @ $15.89 = $95.34
        expect(screen.getByText('$95.34')).toBeInTheDocument()
      })
    })

    it('calculates risk budget per trade', async () => {
      renderWithProviders(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('Risk Budget / Trade')).toBeInTheDocument()
        // $50,000 * 1% = $500
        expect(screen.getByText('$500.00')).toBeInTheDocument()
      })
    })

    it('calculates open risk at stops', async () => {
      renderWithProviders(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('Open Risk (at stops)')).toBeInTheDocument()
        // initialRisk 1.29 * 6 shares = $7.74
        expect(screen.getByText('$7.74')).toBeInTheDocument()
      })
    })

    it('calculates total P&L correctly', async () => {
      renderWithProviders(<Dashboard />)
      
      await waitFor(() => {
        // P&L is now shown next to position count in the hero section
        expect(screen.getByText('Open Positions')).toBeInTheDocument()
        // VALE: (currentPrice $16.30 - entryPrice $15.89) * 6 shares = +$2.46
        expect(screen.getByText('+$2.46')).toBeInTheDocument()
      })
    })

    it('displays positive P&L in green', async () => {
      renderWithProviders(<Dashboard />)
      
      await waitFor(() => {
        const pnlElement = screen.getByText('+$2.46')
        expect(pnlElement).toHaveClass('text-green-600')
      })
    })
  })

  describe('Priority Actions', () => {
    it('displays pending orders count', async () => {
      renderWithProviders(<Dashboard />)
      
      await waitFor(() => {
        // MSW mock returns 1 pending order
        expect(screen.getByText('1 pending order')).toBeInTheDocument()
      })
    })

    it('displays pending order details with snapshot data', async () => {
      renderWithProviders(<Dashboard />)
      
      await waitFor(() => {
        // Badge shows ticker
        expect(screen.getByText('VALE')).toBeInTheDocument()
        // Shows order type
        expect(screen.getByText('SELL_STOP')).toBeInTheDocument()
        // Shows quantity inline (×6 format)
        expect(screen.getByText(/×6/)).toBeInTheDocument()
      })
    })

    it('displays open positions in priority actions', async () => {
      renderWithProviders(<Dashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('1 open position')).toBeInTheDocument()
      })
    })

    it('shows position P&L in priority actions', async () => {
      renderWithProviders(<Dashboard />)
      
      await waitFor(() => {
        // Should show individual position P&L (+$2.46)
        expect(screen.getByText(/\+\$2\.46/)).toBeInTheDocument()
      })
    })

    it('displays empty state when no action items', async () => {
      // Override MSW to return empty data
      const { server } = await import('@/test/mocks/server')
      const { http, HttpResponse } = await import('msw')
      
      server.use(
        http.get('*/api/portfolio/positions', () => {
          return HttpResponse.json({ positions: [] })
        }),
        http.get('*/api/portfolio/orders', () => {
          return HttpResponse.json({ orders: [] })
        })
      )
      
      renderWithProviders(<Dashboard />)
      
      await waitFor(() => {
        expect(screen.getByText(/All caught up/)).toBeInTheDocument()
      })
    })

    it('shows order snapshot data with latest price', async () => {
      renderWithProviders(<Dashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Priority Actions')).toBeInTheDocument()
      })

      // Check that snapshot data is loaded with last price ($16.30 from mock)
      await screen.findByText('$16.30')
    })
  })

  describe('Quick Actions', () => {
    it('renders all quick action buttons', async () => {
      renderWithProviders(<Dashboard />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Run Screener/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Manage Positions/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /View Orders/i })).toBeInTheDocument()
      })
    })

    it('quick action buttons are clickable', async () => {
      const { user } = renderWithProviders(<Dashboard />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Run Screener/i })).toBeInTheDocument()
      })
      
      const screenerButton = screen.getByRole('button', { name: /Run Screener/i })
      expect(screenerButton).not.toBeDisabled()
      
      // Just verify button is clickable - navigation testing is for E2E
      await act(async () => {
        await user.click(screenerButton)
      })
    })
  })

  describe('Getting Started Section', () => {
    it('renders getting started content', async () => {
      renderWithProviders(<Dashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Getting Started')).toBeInTheDocument()
        expect(screen.getByText(/Welcome to Swing Screener!/)).toBeInTheDocument()
      })
    })

    it('contains link to settings', async () => {
      renderWithProviders(<Dashboard />)
      
      await waitFor(() => {
        const settingsLink = screen.getByRole('link', { name: /Settings/i })
        expect(settingsLink).toBeInTheDocument()
        expect(settingsLink).toHaveAttribute('href', '/settings')
      })
    })
  })
})
