import { describe, it, expect, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import Dashboard from './Dashboard'
import { useConfigStore } from '@/stores/configStore'

describe('Dashboard Page', () => {
  beforeEach(() => {
    // Reset config store to defaults
    useConfigStore.setState({
      config: {
        risk: {
          accountSize: 100000,
          riskPercentPerTrade: 1,
          maxOpenPositions: 5,
          maxDailyLoss: 500,
        },
        marketData: {
          dataSource: 'yahoo',
          updateFrequency: 'daily',
        },
      },
    })
  })

  describe('Page Structure', () => {
    it('renders dashboard title', async () => {
      renderWithProviders(<Dashboard />)
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })

    it('renders all main sections', async () => {
      renderWithProviders(<Dashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Portfolio Summary')).toBeInTheDocument()
        expect(screen.getByText("Today's Action Items")).toBeInTheDocument()
        expect(screen.getByText('Quick Actions')).toBeInTheDocument()
        expect(screen.getByText('Getting Started')).toBeInTheDocument()
      })
    })
  })

  describe('Portfolio Summary', () => {
    it('displays account size from config', async () => {
      renderWithProviders(<Dashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Account Size')).toBeInTheDocument()
        expect(screen.getByText('$100,000.00')).toBeInTheDocument()
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

    it('calculates total P&L correctly', async () => {
      renderWithProviders(<Dashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Total P&L')).toBeInTheDocument()
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
      await user.click(screenerButton)
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
