import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor, act } from '@testing-library/react'
import { renderWithProviders, waitForQueriesToSettle } from '@/test/utils'
import Screener from './Screener'
import { useConfigStore } from '@/stores/configStore'
import { useScreenerStore } from '@/stores/screenerStore'
import { DEFAULT_CONFIG } from '@/types/config'

describe('Screener Page', () => {
  beforeEach(() => {
    // Reset config store
    useConfigStore.setState({
      config: DEFAULT_CONFIG,
    })
    useScreenerStore.setState({ lastResult: null })
  })

  describe('Page Structure', () => {
    it('renders screener title and description', async () => {
      renderWithProviders(<Screener />)
      
      expect(screen.getByText('Screener')).toBeInTheDocument()
      expect(screen.getByText(/Find swing trade candidates/i)).toBeInTheDocument()
      await screen.findByText('Universe')
    })

    it('renders controls section', async () => {
      renderWithProviders(<Screener />)
      
      await waitFor(() => {
        expect(screen.getByText('Universe')).toBeInTheDocument()
      })
      expect(screen.getByText('Top N')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Run Screener/i })).toBeInTheDocument()
    })
  })

  describe('Universe Selection', () => {
    it('loads universe options from API', async () => {
      renderWithProviders(<Screener />)
      
      await waitFor(() => {
        const selects = screen.getAllByRole('combobox')
        expect(selects.length).toBeGreaterThan(0)
      })
    })

    it('defaults to mega universe', async () => {
      renderWithProviders(<Screener />)
      
      await waitFor(() => {
        const selects = screen.getAllByRole('combobox')
        const universeSelect = selects[0] as HTMLSelectElement
        expect(universeSelect.value).toBe('mega_all')
      })
    })

    it('universe is selectable', async () => {
      renderWithProviders(<Screener />)
      
      await waitFor(() => {
        const selects = screen.getAllByRole('combobox')
        expect(selects.length).toBeGreaterThan(0)
        expect(selects[0]).not.toBeDisabled()
      })
    })
  })

  describe('Top N Input', () => {
    it('defaults to 20 candidates', async () => {
      renderWithProviders(<Screener />)
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('20')).toBeInTheDocument()
      })
    })

    it('top N input is editable', async () => {
      renderWithProviders(<Screener />)
      
      await waitFor(() => {
        const input = screen.getByDisplayValue('20') as HTMLInputElement
        expect(input).not.toBeDisabled()
        expect(input.type).toBe('number')
      })
    })

    it('has min and max constraints', async () => {
      renderWithProviders(<Screener />)
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('20')).toBeInTheDocument()
      })
      
      const input = screen.getByDisplayValue('20') as HTMLInputElement
      expect(input.min).toBe('1')
      expect(input.max).toBe('200')
    })
  })

  describe('Account Info Display', () => {
    it('displays account size from config', async () => {
      renderWithProviders(<Screener />)
      
      await waitFor(() => {
        expect(screen.getByText(/Account:/i)).toBeInTheDocument()
      })
    })

    it('displays risk per trade', async () => {
      renderWithProviders(<Screener />)
      
      await waitFor(() => {
        expect(screen.getByText(/Risk:/i)).toBeInTheDocument()
      })
    })
  })

  describe('Running Screener', () => {
    it('shows info banner before running', async () => {
      renderWithProviders(<Screener />)
      
      await waitFor(() => {
        expect(screen.getByText(/The screener downloads market data/i)).toBeInTheDocument()
      })
    })

    it('can run screener successfully', async () => {
      const { user, queryClient } = renderWithProviders(<Screener />)
      
      await screen.findByText('Universe')
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Run Screener/i })).toBeInTheDocument()
      })
      
      const runButton = screen.getByRole('button', { name: /Run Screener/i })
      await act(async () => {
        await user.click(runButton)
      })
      
      await waitFor(() => {
        expect(screen.getByText(/Screener completed/i)).toBeInTheDocument()
      }, { timeout: 3000 })
      await waitForQueriesToSettle(queryClient)
    })
  })

  describe('Results Display', () => {
    const buildRecommendation = (verdict: 'RECOMMENDED' | 'NOT_RECOMMENDED') => ({
      verdict,
      reasons_short: verdict === 'RECOMMENDED' ? ['Signal active with valid stop.'] : ['RR below 2.0.'],
      reasons_detailed: [
        {
          code: verdict === 'RECOMMENDED' ? 'OK' : 'RR_TOO_LOW',
          message: verdict === 'RECOMMENDED' ? 'All gates passed.' : 'Reward-to-risk is below the minimum threshold.',
          severity: verdict === 'RECOMMENDED' ? 'info' : 'block',
          rule: 'R3',
          metrics: {},
        },
      ],
      risk: {
        entry: 175.5,
        stop: 170.0,
        target: 186.5,
        rr: verdict === 'RECOMMENDED' ? 2.0 : 1.0,
        risk_amount: 55.0,
        risk_pct: 0.001,
        position_size: 1755.0,
        shares: 10,
        invalidation_level: 170.0,
      },
      costs: {
        commission_estimate: 0.0,
        fx_estimate: 0.0,
        slippage_estimate: 1.0,
        total_cost: 1.0,
        fee_to_risk_pct: 0.02,
      },
      checklist: [
        {
          gate_name: 'rr_threshold',
          passed: verdict === 'RECOMMENDED',
          explanation: verdict === 'RECOMMENDED' ? 'RR >= 2.0.' : 'RR below 2.0.',
          rule: 'R3',
        },
      ],
      education: {
        common_bias_warning: 'Small wins/large losses tendency.',
        what_to_learn: 'Require asymmetric payoff before acting.',
        what_would_make_valid: verdict === 'RECOMMENDED' ? [] : ['Tighten the stop or aim for a higher target.'],
      },
    })

    const buildCandidate = (verdict: 'RECOMMENDED' | 'NOT_RECOMMENDED') => ({
      ticker: 'AAPL',
      rank: 1,
      score: 0.95,
      close: 175.50,
      last_bar: '2026-02-07T16:00:00',
      sma_20: 170.00,
      sma_50: 165.00,
      sma_200: 160.00,
      atr: 3.25,
      momentum_6m: 25.0,
      momentum_12m: 45.0,
      rel_strength: 85.2,
      confidence: 72.5,
      overlay_status: 'OK',
      overlay_reasons: [],
      overlay_risk_multiplier: 1.0,
      overlay_max_pos_multiplier: 1.0,
      overlay_attention_z: 0.5,
      overlay_sentiment_score: 0.1,
      overlay_sentiment_confidence: 0.4,
      overlay_hype_score: 2.0,
      overlay_sample_size: 30,
      signal: 'breakout',
      entry: 175.5,
      stop: 170.0,
      target: 186.5,
      rr: verdict === 'RECOMMENDED' ? 2.0 : 1.0,
      shares: 10,
      position_size_usd: 1755.0,
      risk_usd: 55.0,
      risk_pct: 0.001,
      recommendation: buildRecommendation(verdict),
    })

    it('shows results summary after running', async () => {
      const { user } = renderWithProviders(<Screener />)
      
      const runButton = screen.getByRole('button', { name: /Run Screener/i })
      await act(async () => {
        await user.click(runButton)
      })
      
      await waitFor(() => {
        expect(screen.getByText(/1 candidates from/i)).toBeInTheDocument()
        expect(screen.getByText(/As of: 2026-02-08/i)).toBeInTheDocument()
      })
    })

    it('displays candidates table with correct headers', async () => {
      const { user } = renderWithProviders(<Screener />)

      await act(async () => {
        await user.click(screen.getByRole('button', { name: /Run Screener/i }))
      })

      await waitFor(() => {
        expect(screen.getByText('Rank')).toBeInTheDocument()
        expect(screen.getByText('Ticker')).toBeInTheDocument()
        expect(screen.getByText('Last Bar')).toBeInTheDocument()
        expect(screen.getByText('Close')).toBeInTheDocument()
        expect(screen.getByText('ATR')).toBeInTheDocument()
        expect(screen.getByText('Risk $')).toBeInTheDocument()
        expect(screen.getByText('RR')).toBeInTheDocument()
        expect(screen.getByText('Mom 6M')).toBeInTheDocument()
        expect(screen.getByText('Mom 12M')).toBeInTheDocument()
        expect(screen.getByText('Score')).toBeInTheDocument()
        expect(screen.getByText('Verdict')).toBeInTheDocument()
        expect(screen.getByText('Fix')).toBeInTheDocument()
      })
    })

    it('displays candidate data correctly', async () => {
      const { user } = renderWithProviders(<Screener />)
      
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /Run Screener/i }))
      })
      
      await waitFor(() => {
        // MSW mock returns AAPL candidate
        expect(screen.getByText('AAPL')).toBeInTheDocument()
        expect(screen.getByText('#1')).toBeInTheDocument()
        expect(screen.getByText('$175.50')).toBeInTheDocument()
        expect(screen.getByText('3.25')).toBeInTheDocument()
      })
    })

    it('shows momentum values with color coding', async () => {
      const { user } = renderWithProviders(<Screener />)
      
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /Run Screener/i }))
      })
      
      await waitFor(() => {
        // Mock has positive momentum
        const mom6m = screen.getByText('+25.0%')
        const mom12m = screen.getByText('+45.0%')
        
        expect(mom6m).toHaveClass('text-green-600')
        expect(mom12m).toHaveClass('text-green-600')
      })
    })

    it('displays create order button for each candidate', async () => {
      const { user } = renderWithProviders(<Screener />)
      
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /Run Screener/i }))
      })
      
      await waitFor(() => {
        const createButtons = screen.getAllByRole('button', { name: /Create Order/i })
        expect(createButtons.length).toBeGreaterThan(0)
      })
    })

    it('displays recommendation verdict badge when provided', async () => {
      const { server } = await import('@/test/mocks/server')
      const { http, HttpResponse } = await import('msw')

      server.use(
        http.post('*/api/screener/run', () => {
          return HttpResponse.json({
            candidates: [buildCandidate('RECOMMENDED')],
            asof_date: '2026-02-08',
            total_screened: 1,
            warnings: [],
          })
        })
      )

      const { user } = renderWithProviders(<Screener />)
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /Run Screener/i }))
      })

      await waitFor(() => {
        expect(screen.getByText('Recommended')).toBeInTheDocument()
      })
    })

    it('disables create order when not recommended', async () => {
      const { server } = await import('@/test/mocks/server')
      const { http, HttpResponse } = await import('msw')

      server.use(
        http.post('*/api/screener/run', () => {
          return HttpResponse.json({
            candidates: [buildCandidate('NOT_RECOMMENDED')],
            asof_date: '2026-02-08',
            total_screened: 1,
            warnings: [],
          })
        })
      )

      const { user } = renderWithProviders(<Screener />)
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /Run Screener/i }))
      })

      await waitFor(() => {
        expect(screen.getByText('Not Recommended')).toBeInTheDocument()
      })

      await act(async () => {
        await user.click(screen.getByRole('button', { name: /Create Order/i }))
      })

      await waitFor(() => {
        expect(screen.getByText(/Create Order - AAPL/i)).toBeInTheDocument()
      })

      const createButtons = screen.getAllByRole('button', { name: /Create Order/i })
      expect(createButtons.some((button) => button.hasAttribute('disabled'))).toBe(true)
    })

    it('opens sentiment analysis modal from candidate row', async () => {
      const { user } = renderWithProviders(<Screener />)

      await act(async () => {
        await user.click(screen.getByRole('button', { name: /Run Screener/i }))
      })

      await waitFor(() => {
        expect(screen.getByText('AAPL')).toBeInTheDocument()
      })

      const sentimentButton = screen.getByRole('button', { name: /Sentiment for AAPL/i })
      await act(async () => {
        await user.click(sentimentButton)
      })

      await waitFor(() => {
        expect(screen.getByText('Sentiment Analysis - AAPL')).toBeInTheDocument()
      })

      expect(screen.getByLabelText(/Lookback Override/i)).toBeInTheDocument()
    })

    it('opens recommendation details modal from candidate row', async () => {
      const { user } = renderWithProviders(<Screener />)

      await act(async () => {
        await user.click(screen.getByRole('button', { name: /Run Screener/i }))
      })

      await waitFor(() => {
        expect(screen.getByText('AAPL')).toBeInTheDocument()
      })

      const detailsButton = screen.getByRole('button', { name: /Recommendation details for AAPL/i })
      await act(async () => {
        await user.click(detailsButton)
      })

      await waitFor(() => {
        expect(screen.getByText(/Recommendation — AAPL/i)).toBeInTheDocument()
      })
    })
  })

  describe('Refresh Functionality', () => {
    it('shows refresh button after results displayed', async () => {
      const { user } = renderWithProviders(<Screener />)
      
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /Run Screener/i }))
      })
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Refresh/i })).toBeInTheDocument()
      })
    })
  })

  describe('Empty State', () => {
    it('shows no candidates message when results are empty', async () => {
      const { server } = await import('@/test/mocks/server')
      const { http, HttpResponse } = await import('msw')
      
      // Override to return empty results
      server.use(
        http.post('*/api/screener/run', () => {
          return HttpResponse.json({
            candidates: [],
            asof_date: '2026-02-08',
            total_screened: 0,
            warnings: ['No candidates found for the current screener filters.'],
          })
        })
      )
      
      const { user } = renderWithProviders(<Screener />)
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /Run Screener/i }))
      })
      
      await waitFor(() => {
        expect(screen.getByText(/^No candidates found$/i)).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('displays error message on screener failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { server } = await import('@/test/mocks/server')
      const { http, HttpResponse } = await import('msw')
      
      server.use(
        http.post('*/api/screener/run', () => {
          return HttpResponse.json(
            { detail: 'Failed to fetch market data' },
            { status: 500 }
          )
        })
      )
      
      const { user } = renderWithProviders(<Screener />)
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /Run Screener/i }))
      })
      
      await waitFor(() => {
        expect(screen.getByText(/Error:/i)).toBeInTheDocument()
        expect(screen.getByText(/Failed to fetch market data/i)).toBeInTheDocument()
      })
      consoleSpy.mockRestore()
    })
  })

  describe('Warnings', () => {
    it('shows warning banner when API returns warnings', async () => {
      const { server } = await import('@/test/mocks/server')
      const { http, HttpResponse } = await import('msw')
      
      server.use(
        http.post('*/api/screener/run', () => {
          return HttpResponse.json({
            candidates: [],
            asof_date: '2026-02-08',
            total_screened: 120,
            warnings: ['Only 0 candidates found for top 200.'],
          })
        })
      )
      
      const { user } = renderWithProviders(<Screener />)
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /Run Screener/i }))
      })
      
      await waitFor(() => {
        expect(screen.getByText(/Only 0 candidates found for top 200/i)).toBeInTheDocument()
      })
    })
  })
})
