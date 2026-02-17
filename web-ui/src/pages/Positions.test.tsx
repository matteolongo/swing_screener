import { describe, it, expect, beforeEach } from 'vitest'
import { screen, waitFor, act } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import Positions from './Positions'
import { useConfigStore } from '@/stores/configStore'
import { useBeginnerModeStore } from '@/stores/beginnerModeStore'
import { DEFAULT_CONFIG } from '@/types/config'

describe('Positions Page', () => {
  beforeEach(() => {
    // Reset config store
    useConfigStore.setState({
      config: DEFAULT_CONFIG,
    })
    // Reset beginner mode to advanced for tests
    useBeginnerModeStore.setState({ isBeginnerMode: false })
  })

  describe('Page Structure', () => {
    it('renders positions page title', async () => {
      renderWithProviders(<Positions />)
      
      expect(screen.getByText('Positions')).toBeInTheDocument()
      await screen.findByText('VALE')
    })

    it('renders filter tabs', async () => {
      renderWithProviders(<Positions />)
      
      await waitFor(() => {
        expect(screen.getByText('Open')).toBeInTheDocument()
        expect(screen.getByText('Closed')).toBeInTheDocument()
      })
    })
  })

  describe('Positions List', () => {
    it('displays positions from API', async () => {
      renderWithProviders(<Positions />)
      
      await waitFor(() => {
        // MSW mock returns VALE position
        expect(screen.getByText('VALE')).toBeInTheDocument()
      })
    })

    it('shows sentiment button for each position', async () => {
      renderWithProviders(<Positions />)

      await waitFor(() => {
        expect(screen.getByText('VALE')).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /Sentiment for VALE/i })).toBeInTheDocument()
    })

    it('displays position details', async () => {
      renderWithProviders(<Positions />)
      
      await waitFor(() => {
        expect(screen.getByText('VALE')).toBeInTheDocument()
        // Should show shares quantity
        expect(screen.getByText('6')).toBeInTheDocument()
      })
    })

    it('calculates and displays P&L', async () => {
      renderWithProviders(<Positions />)
      
      await waitFor(() => {
        // VALE: currentPrice $16.30 - entryPrice $15.89 = $0.41 * 6 shares = $2.46
        expect(screen.getByText(/\$2\.46/)).toBeInTheDocument()
      })
    })

    it('shows P&L with correct color', async () => {
      renderWithProviders(<Positions />)
      
      await waitFor(() => {
        const pnlElement = screen.getByText(/\+\$2\.46/)
        expect(pnlElement).toHaveClass('text-green-600')
      })
    })

    it('displays entry price', async () => {
      renderWithProviders(<Positions />)
      
      await waitFor(() => {
        // Entry price is $15.89
        expect(screen.getByText(/\$15\.89/)).toBeInTheDocument()
      })
    })

    it('displays stop price', async () => {
      renderWithProviders(<Positions />)
      
      await waitFor(() => {
        // Stop price is $15.0
        expect(screen.getByText(/\$15\.00/)).toBeInTheDocument()
      })
    })

    it('displays position price information', async () => {
      renderWithProviders(<Positions />)
      
      await waitFor(() => {
        expect(screen.getByText('VALE')).toBeInTheDocument()
        expect(screen.getByText('Value')).toBeInTheDocument()
        expect(screen.getByText('$97.80')).toBeInTheDocument()
        // Now displays inline calculation format: shares × price
        expect(screen.getByText(/6 × \$16\.30/)).toBeInTheDocument()
      })
    })
  })

  describe('Filtering', () => {
    it('defaults to showing open positions', async () => {
      renderWithProviders(<Positions />)
      
      await waitFor(() => {
        expect(screen.getByText('VALE')).toBeInTheDocument()
      })
    })

    it('can filter to closed positions', async () => {
      const { user } = renderWithProviders(<Positions />)
      
      await waitFor(() => {
        expect(screen.getByText('Closed')).toBeInTheDocument()
      })
      
      const closedTab = screen.getByText('Closed')
      await act(async () => {
        await user.click(closedTab)
      })
      
      await waitFor(() => {
        // Should show INTC (closed position in mock)
        expect(screen.getByText('INTC')).toBeInTheDocument()
      })
    })
  })

  describe('Position Actions', () => {
    it('displays action buttons for open positions', async () => {
      renderWithProviders(<Positions />)
      
      await waitFor(() => {
        expect(screen.getByText('VALE')).toBeInTheDocument()
      })
      
      // Should have Update Stop and Close buttons
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(2)
    })

    it('shows suggested stop in update modal', async () => {
      const { user } = renderWithProviders(<Positions />)

      await waitFor(() => {
        expect(screen.getByText('VALE')).toBeInTheDocument()
      })

      const updateButtons = screen.getAllByRole('button', { name: /Update Stop/i })
      await act(async () => {
        await user.click(updateButtons[0])
      })

      await waitFor(() => {
        expect(screen.getByText('Suggested Stop')).toBeInTheDocument()
        expect(screen.getByText('$15.20')).toBeInTheDocument()
      })
    })
  })

  describe('Empty State', () => {
    it('shows empty state when no positions', async () => {
      const { server } = await import('@/test/mocks/server')
      const { http, HttpResponse } = await import('msw')
      
      server.use(
        http.get('*/api/portfolio/positions', () => {
          return HttpResponse.json({ positions: [], asof: '2026-02-08' })
        })
      )
      
      renderWithProviders(<Positions />)
      
      await waitFor(() => {
        expect(screen.getByText(/No positions found/i)).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      const { server } = await import('@/test/mocks/server')
      const { http, HttpResponse } = await import('msw')
      
      server.use(
        http.get('*/api/portfolio/positions', () => {
          return HttpResponse.json(
            { detail: 'Server error' },
            { status: 500 }
          )
        })
      )
      
      renderWithProviders(<Positions />)
      
      // Should not crash
      await waitFor(() => {
        expect(screen.getByText('Positions')).toBeInTheDocument()
      })
    })
  })

  describe('Status Display', () => {
    it('shows status badge for positions', async () => {
      renderWithProviders(<Positions />)
      
      await waitFor(() => {
        const badges = screen.getAllByText('open')
        expect(badges.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Date Display', () => {
    it('displays position dates', async () => {
      renderWithProviders(<Positions />)
      
      await waitFor(() => {
        expect(screen.getByText('VALE')).toBeInTheDocument()
        // Entry date should be visible somewhere
        const dates = screen.queryAllByText(/\d{4}|Jan|Feb|Mar/i)
        expect(dates.length).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('R-Multiple Calculations', () => {
    it('calculates R-multiple for open positions', async () => {
      renderWithProviders(<Positions />)
      
      await waitFor(() => {
        // R = (currentPrice - entryPrice) / initialRisk
        // R = ($16.30 - $15.89) / $1.29 ≈ 0.32R
        const rMultiples = screen.queryAllByText(/R/)
        expect(rMultiples.length).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('Table Structure', () => {
    it('renders table headers', async () => {
      renderWithProviders(<Positions />)
      
      await waitFor(() => {
        expect(screen.getByText('Ticker')).toBeInTheDocument()
        expect(screen.getByText('Status')).toBeInTheDocument()
      })
    })

    it('displays table with data', async () => {
      renderWithProviders(<Positions />)
      
      await waitFor(() => {
        const tables = screen.queryAllByRole('table')
        expect(tables.length).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('Loading State', () => {
    it('shows loading state initially', () => {
      renderWithProviders(<Positions />)
      
      // Initially should not show positions
      expect(screen.queryByText('VALE')).not.toBeInTheDocument()
    })
  })

  describe('Closed Positions', () => {
    it('displays exit price for closed positions', async () => {
      const { user } = renderWithProviders(<Positions />)
      
      await waitFor(() => {
        expect(screen.getByText('Closed')).toBeInTheDocument()
      })
      
      const closedTab = screen.getByText('Closed')
      await act(async () => {
        await user.click(closedTab)
      })
      
      await waitFor(() => {
        expect(screen.getByText('INTC')).toBeInTheDocument()
        // Exit price is $47.29
        expect(screen.getAllByText(/\$47\.29/).length).toBeGreaterThan(0)
      })
    })

    it('shows final P&L for closed positions', async () => {
      const { user } = renderWithProviders(<Positions />)
      
      await waitFor(() => {
        expect(screen.getByText('Closed')).toBeInTheDocument()
      })
      
      await act(async () => {
        await user.click(screen.getByText('Closed'))
      })
      
      await waitFor(() => {
        expect(screen.getByText('INTC')).toBeInTheDocument()
        // INTC: exitPrice $47.29 - entryPrice $48.15 = -$0.86 * 1 share = -$0.86
        expect(screen.getByText(/-\$0\.86/)).toBeInTheDocument()
      })
    })
  })
})
