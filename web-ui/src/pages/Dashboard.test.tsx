import { describe, it, expect, beforeEach } from 'vitest'
import { screen, waitFor, within, act } from '@testing-library/react'
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
        expect(screen.getByText("Today's Action Items")).toBeInTheDocument()
        expect(screen.getByText('Daily Routine (Top 3)')).toBeInTheDocument()
        expect(screen.getByText('Open Orders Snapshot')).toBeInTheDocument()
        expect(screen.getByText('Quick Actions')).toBeInTheDocument()
        expect(screen.getByText('Getting Started')).toBeInTheDocument()
      })
    })
  })

  describe('Strategy Coach', () => {
    it('renders strategy coach card with active strategy values', async () => {
      renderWithProviders(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('Strategy Coach')).toBeInTheDocument()
        expect(screen.getByText(/Active:/i)).toBeInTheDocument()
        expect(screen.getByText('Default')).toBeInTheDocument()
        expect(screen.getByText(/Stop = Entry - \(2.0 x ATR\(14\)\)/i)).toBeInTheDocument()
        expect(screen.getByText(/Breakeven at \+1.0R, trail after \+2.0R using SMA\(20\)/i)).toBeInTheDocument()
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

  describe('Daily Routine', () => {
    it('renders the daily routine checklist', async () => {
      renderWithProviders(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('Daily Routine (Top 3)')).toBeInTheDocument()
        expect(screen.getByText(/DO NOTHING/)).toBeInTheDocument()
        expect(screen.getByText(/INCREASE STOP LOSS PRICE/)).toBeInTheDocument()
        expect(screen.getByText(/PLACE BUY LIMIT ORDER FOR TOP 3 screened symbols/)).toBeInTheDocument()
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
        expect(screen.getByText(/Total P&L/i)).toBeInTheDocument()
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

  describe('Action Items', () => {
    it('displays pending orders count', async () => {
      renderWithProviders(<Dashboard />)
      
      await waitFor(() => {
        // MSW mock returns 1 pending order
        expect(screen.getByText('1 pending order')).toBeInTheDocument()
      })
    })

    it('displays pending order details', async () => {
      renderWithProviders(<Dashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('VALE')).toBeInTheDocument()
        expect(screen.getByText(/SELL_STOP/)).toBeInTheDocument()
        // Order has 6 shares according to mock
        expect(screen.getByText(/6 shares/)).toBeInTheDocument()
      })
    })

    it('displays open positions in action items', async () => {
      renderWithProviders(<Dashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('1 open position')).toBeInTheDocument()
      })
    })

    it('shows position P&L in action items', async () => {
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
        expect(screen.getByText(/No action items/)).toBeInTheDocument()
        expect(screen.getByText(/You're all caught up!/)).toBeInTheDocument()
      })
    })
  })

  describe('Open Orders Snapshot', () => {
    it('shows snapshot table with latest close and distance', async () => {
      renderWithProviders(<Dashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Open Orders Snapshot')).toBeInTheDocument()
      })

      await screen.findByText('$16.30')
      const table = screen.getByRole('table')
      const tableScope = within(table)
      expect(tableScope.getByText('VALE')).toBeInTheDocument()
      expect(tableScope.getByText('SELL_STOP')).toBeInTheDocument()
      expect(tableScope.getByText('-8.6%')).toBeInTheDocument()
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
