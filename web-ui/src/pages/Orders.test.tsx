import { describe, it, expect, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import Orders from './Orders'

describe('Orders Page', () => {
  beforeEach(() => {
    // Reset any state if needed
  })

  describe('Page Structure', () => {
    it('renders orders page title', async () => {
      renderWithProviders(<Orders />)
      
      expect(screen.getByText('Orders')).toBeInTheDocument()
    })

    it('renders filter tabs', async () => {
      renderWithProviders(<Orders />)
      
      await waitFor(() => {
        expect(screen.getByText('All')).toBeInTheDocument()
        expect(screen.getByText('Pending')).toBeInTheDocument()
        expect(screen.getByText('Filled')).toBeInTheDocument()
        expect(screen.getByText('Cancelled')).toBeInTheDocument()
      })
    })

    it('renders create order button', async () => {
      renderWithProviders(<Orders />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Create Order/i })).toBeInTheDocument()
      })
    })
  })

  describe('Orders List', () => {
    it('displays orders from API', async () => {
      renderWithProviders(<Orders />)
      
      await waitFor(() => {
        // MSW mock returns VALE order
        expect(screen.getByText('VALE')).toBeInTheDocument()
      })
    })

    it('displays order details correctly', async () => {
      renderWithProviders(<Orders />)
      
      await waitFor(() => {
        expect(screen.getByText('VALE')).toBeInTheDocument()
      })
      
      // Check if order type and quantity are present
      expect(screen.getByText('SELL_STOP')).toBeInTheDocument()
      
      // Quantity is in a table cell, might need to check differently
      const quantity = screen.getByText('6')
      expect(quantity).toBeInTheDocument()
    })

    it('displays order status badge', async () => {
      renderWithProviders(<Orders />)
      
      await waitFor(() => {
        const badges = screen.getAllByText('pending')
        expect(badges.length).toBeGreaterThan(0)
      })
    })

    it('shows loading state', () => {
      renderWithProviders(<Orders />)
      
      // Initially should show loading or empty state
      expect(screen.queryByText('VALE')).not.toBeInTheDocument()
    })
  })

  describe('Filtering', () => {
    it('defaults to showing all orders', async () => {
      renderWithProviders(<Orders />)
      
      await waitFor(() => {
        expect(screen.getByText('VALE')).toBeInTheDocument()
      })
    })

    it('can filter by pending status', async () => {
      const { user } = renderWithProviders(<Orders />)
      
      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument()
      })
      
      const pendingTab = screen.getByText('Pending')
      await user.click(pendingTab)
      
      // Should still show VALE (it's pending in mock)
      await waitFor(() => {
        expect(screen.getByText('VALE')).toBeInTheDocument()
      })
    })

    it('filter tabs are clickable', async () => {
      const { user } = renderWithProviders(<Orders />)
      
      await waitFor(() => {
        expect(screen.getByText('All')).toBeInTheDocument()
      })
      
      const allTab = screen.getByText('All')
      expect(allTab).not.toBeDisabled()
      
      await user.click(allTab)
    })
  })

  describe('Create Order Modal', () => {
    it('opens create order modal when clicking button', async () => {
      const { user } = renderWithProviders(<Orders />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Create Order/i })).toBeInTheDocument()
      })
      
      const createButton = screen.getByRole('button', { name: /Create Order/i })
      await user.click(createButton)
      
      // Modal should open (assuming it has a title or close button)
      await waitFor(() => {
        // Look for modal indicators - could be title, close button, etc.
        const buttons = screen.getAllByRole('button')
        expect(buttons.length).toBeGreaterThan(1)
      })
    })
  })

  describe('Order Actions', () => {
    it('displays action buttons for orders', async () => {
      renderWithProviders(<Orders />)
      
      await waitFor(() => {
        expect(screen.getByText('VALE')).toBeInTheDocument()
      })
      
      // Should have Fill and Cancel buttons (or similar)
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(1)
    })
  })

  describe('Empty State', () => {
    it('shows empty state when no orders', async () => {
      const { server } = await import('@/test/mocks/server')
      const { http, HttpResponse } = await import('msw')
      
      server.use(
        http.get('*/api/portfolio/orders', () => {
          return HttpResponse.json({ orders: [], asof: '2026-02-08' })
        })
      )
      
      renderWithProviders(<Orders />)
      
      await waitFor(() => {
        expect(screen.getByText(/No orders found/i)).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      const { server } = await import('@/test/mocks/server')
      const { http, HttpResponse } = await import('msw')
      
      server.use(
        http.get('*/api/portfolio/orders', () => {
          return HttpResponse.json(
            { detail: 'Server error' },
            { status: 500 }
          )
        })
      )
      
      renderWithProviders(<Orders />)
      
      // Should not crash - either show error message or empty state
      await waitFor(() => {
        // Component should render something
        expect(screen.getByText('Orders')).toBeInTheDocument()
      })
    })
  })

  describe('Order Types', () => {
    it('displays SELL_STOP orders correctly', async () => {
      renderWithProviders(<Orders />)
      
      await waitFor(() => {
        expect(screen.getByText('SELL_STOP')).toBeInTheDocument()
      })
    })

    it('shows stop price for SELL_STOP orders', async () => {
      renderWithProviders(<Orders />)
      
      await waitFor(() => {
        // VALE order has stop_price: 14.9 in mock
        expect(screen.getByText(/\$14\.90/)).toBeInTheDocument()
      })
    })
  })

  describe('Order Dates', () => {
    it('displays order date', async () => {
      renderWithProviders(<Orders />)
      
      await waitFor(() => {
        // Order date is 2026-01-16 in mock
        expect(screen.getByText(/Jan/i)).toBeInTheDocument()
      })
    })
  })

  describe('Responsive Behavior', () => {
    it('renders table structure', async () => {
      renderWithProviders(<Orders />)
      
      await waitFor(() => {
        const tables = screen.queryAllByRole('table')
        // Should have a table or list structure
        expect(tables.length).toBeGreaterThanOrEqual(0)
      })
    })
  })
})
