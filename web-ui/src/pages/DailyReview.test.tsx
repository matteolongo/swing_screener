import { beforeEach, describe, expect, it } from 'vitest'
import { act, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { renderWithProviders } from '@/test/utils'
import { server } from '@/test/mocks/server'
import DailyReview from './DailyReview'

const mockDailyReview = {
  new_candidates: [
    {
      ticker: 'VALE',
      rank: 3,
      priority_rank: 1,
      confidence: 91.6,
      signal: 'breakout',
      close: 17.2,
      entry: 17.38,
      stop: 16.36,
      shares: 8,
      r_reward: 2.0,
      name: 'Vale SA',
      sector: 'Basic Materials',
      recommendation: {
        verdict: 'RECOMMENDED',
        reasons_short: ['Signal active with valid stop.'],
        reasons_detailed: [],
        risk: {
          entry: 17.38,
          stop: 16.36,
          target: 19.42,
          rr: 2.0,
          risk_amount: 8.16,
          risk_pct: 0.0082,
          position_size: 139.04,
          shares: 8,
          invalidation_level: 16.36,
        },
        costs: {
          commission_estimate: 0.0,
          fx_estimate: 0.0,
          slippage_estimate: 0.15,
          total_cost: 0.15,
          fee_to_risk_pct: 0.02,
        },
        checklist: [
          {
            gate_name: 'rr_threshold',
            passed: true,
            explanation: 'RR >= 2.0.',
            rule: 'R3',
          },
        ],
        education: {
          common_bias_warning: 'Do not chase late entries.',
          what_to_learn: 'Keep asymmetry first.',
          what_would_make_valid: [],
        },
      },
      decision_summary: {
        symbol: 'VALE',
        action: 'BUY_NOW',
        conviction: 'high',
        technical_label: 'strong',
        fundamentals_label: 'strong',
        valuation_label: 'fair',
        catalyst_label: 'active',
        why_now: 'Ready now.',
        what_to_do: 'Act.',
        main_risk: 'Execution.',
        trade_plan: {
          entry: 17.38,
          stop: 16.36,
          target: 19.42,
          rr: 2.0,
        },
        valuation_context: {
          method: 'earnings_multiple',
        },
        drivers: {
          positives: ['Ready.'],
          negatives: [],
          warnings: [],
        },
      },
    },
  ],
  positions_add_on_candidates: [],
  positions_hold: [
    {
      position_id: 'POS-1',
      ticker: 'AAPL',
      entry_price: 150.0,
      stop_price: 145.0,
      current_price: 154.0,
      r_now: 0.8,
      reason: 'Still above trail',
    },
  ],
  positions_update_stop: [
    {
      position_id: 'POS-2',
      ticker: 'MSFT',
      entry_price: 400.0,
      stop_current: 390.0,
      stop_suggested: 395.0,
      current_price: 410.0,
      r_now: 1.0,
      reason: 'Trail condition met',
    },
  ],
  positions_close: [],
  summary: {
    total_positions: 2,
    no_action: 1,
    update_stop: 1,
    close_positions: 0,
    new_candidates: 1,
    add_on_candidates: 0,
    review_date: '2026-02-12',
  },
}

describe('DailyReview Page', () => {
  beforeEach(() => {
    server.use(
      http.get('*/api/daily-review', () => HttpResponse.json(mockDailyReview))
    )
  })

  it('renders glossary blocks and help-labeled table columns', async () => {
    renderWithProviders(<DailyReview />)

    await waitFor(() => {
      expect(screen.getByText('Daily Review Glossary')).toBeInTheDocument()
      expect(screen.getByText('Stop Management Glossary')).toBeInTheDocument()
      expect(screen.getByText('Priority')).toBeInTheDocument()
      expect(screen.getByText('R:R')).toBeInTheDocument()
      expect(screen.getAllByText('R Now').length).toBeGreaterThan(0)
      expect(screen.getByText('Raw #3')).toBeInTheDocument()
      expect(screen.getByText('Buy Now · High')).toBeInTheDocument()
    })
  })

  it('opens the combined order review modal from the create order action', async () => {
    const { user } = renderWithProviders(<DailyReview />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Create Order/i })).toBeInTheDocument()
    })

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /Create Order/i }))
    })

    await waitFor(() => {
      expect(screen.getByText(/Create Order - VALE/i)).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Decision' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByText('Place Order')).toBeInTheDocument()
    })
  })

  it('shows only recommended candidates in New Trade Candidates', async () => {
    server.use(
      http.get('*/api/daily-review', () => HttpResponse.json({
        ...mockDailyReview,
        new_candidates: [
          ...mockDailyReview.new_candidates,
          {
            ticker: 'NOREC',
            confidence: 70.0,
            signal: 'pullback',
            close: 10.2,
            entry: 10.0,
            stop: 9.8,
            shares: 10,
            r_reward: 1.2,
            name: 'Not Recommended Corp',
            sector: 'Utilities',
            recommendation: {
              ...mockDailyReview.new_candidates[0].recommendation,
              verdict: 'NOT_RECOMMENDED',
              reasons_short: ['RR below minimum.'],
            },
          },
        ],
      }))
    )

    renderWithProviders(<DailyReview />)

    await waitFor(() => {
      expect(screen.getByText('VALE')).toBeInTheDocument()
      expect(screen.queryByText('NOREC')).not.toBeInTheDocument()
      expect(screen.getByText(/showing recommended setups only/i)).toBeInTheDocument()
    })
  })

  it('formats technical time-exit reasons into clear action text', async () => {
    server.use(
      http.get('*/api/daily-review', () => HttpResponse.json({
        ...mockDailyReview,
        positions_close: [
          {
            position_id: 'POS-3',
            ticker: 'VALE',
            entry_price: 16.3,
            stop_price: 15.0,
            current_price: 16.65,
            r_now: 0.27,
            reason: 'Time exit: 20 bars since entry_date >= 20',
          },
        ],
        summary: {
          ...mockDailyReview.summary,
          close_positions: 1,
        },
      }))
    )

    renderWithProviders(<DailyReview />)

    await waitFor(() => {
      expect(
        screen.getByText(
          'Held for 20 bars (max 20). Close to free capital for stronger setups.'
        )
      ).toBeInTheDocument()
    })
  })

  it('closes Create Order modal with Escape and with close button', async () => {
    const { user } = renderWithProviders(<DailyReview />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Create Order/i })).toBeInTheDocument()
    })

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /Create Order/i }))
    })

    await waitFor(() => {
      expect(screen.getByText(/Create Order - VALE/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Close create order modal/i })).toBeInTheDocument()
    })

    await act(async () => {
      await user.keyboard('{Escape}')
    })

    await waitFor(() => {
      expect(screen.queryByText(/Create Order - VALE/i)).not.toBeInTheDocument()
    })

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /Create Order/i }))
    })

    await waitFor(() => {
      expect(screen.getByText(/Create Order - VALE/i)).toBeInTheDocument()
    })

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /Close create order modal/i }))
    })

    await waitFor(() => {
      expect(screen.queryByText(/Create Order - VALE/i)).not.toBeInTheDocument()
    })
  })

  it('keeps candidate actions available without embedded intelligence controls', async () => {
    renderWithProviders(<DailyReview />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Create Order/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Run Intelligence/i })).not.toBeInTheDocument()
    })
  })

  it('does not show inline watch controls in daily review tables', async () => {
    renderWithProviders(<DailyReview />)

    await waitFor(() => {
      expect(screen.getByText('VALE')).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: /Watch VALE/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Unwatch VALE/i })).not.toBeInTheDocument()
  })

  it('filters candidate sections by decision action and can reveal watch ideas when recommended-only is disabled', async () => {
    server.use(
      http.get('*/api/daily-review', () => HttpResponse.json({
        ...mockDailyReview,
        new_candidates: [
          ...mockDailyReview.new_candidates,
          {
            ticker: 'PULL',
            rank: 1,
            priority_rank: 2,
            confidence: 88.2,
            signal: 'pullback',
            close: 40.5,
            entry: 40.2,
            stop: 38.9,
            shares: 5,
            r_reward: 2.1,
            name: 'Pullback Co',
            sector: 'Industrials',
            recommendation: {
              ...mockDailyReview.new_candidates[0].recommendation,
              verdict: 'RECOMMENDED',
            },
            decision_summary: {
              ...mockDailyReview.new_candidates[0].decision_summary,
              symbol: 'PULL',
              action: 'BUY_ON_PULLBACK',
              conviction: 'medium',
            },
          },
          {
            ticker: 'WATCHX',
            rank: 2,
            priority_rank: 3,
            confidence: 70,
            signal: 'watch',
            close: 22,
            entry: 22.4,
            stop: 21,
            shares: 4,
            r_reward: 1.2,
            name: 'Watch Inc',
            sector: 'Utilities',
            recommendation: {
              ...mockDailyReview.new_candidates[0].recommendation,
              verdict: 'NOT_RECOMMENDED',
              reasons_short: ['Not ready yet.'],
            },
            decision_summary: {
              ...mockDailyReview.new_candidates[0].decision_summary,
              symbol: 'WATCHX',
              action: 'WATCH',
              conviction: 'medium',
            },
          },
        ],
        summary: {
          ...mockDailyReview.summary,
          new_candidates: 3,
        },
      }))
    )

    const { user } = renderWithProviders(<DailyReview />)

    await waitFor(() => {
      expect(screen.getByText('VALE')).toBeInTheDocument()
      expect(screen.queryByText('WATCHX')).not.toBeInTheDocument()
    })

    await act(async () => {
      await user.click(screen.getByRole('checkbox', { name: /show recommended only/i }))
    })

    await act(async () => {
      await user.selectOptions(screen.getByLabelText(/decision action/i), 'WATCH')
    })

    await waitFor(() => {
      expect(screen.getByText('WATCHX')).toBeInTheDocument()
      expect(screen.queryByText('VALE')).not.toBeInTheDocument()
      expect(screen.queryByText('PULL')).not.toBeInTheDocument()
      expect(screen.getByText(/showing 1 of 3 candidates for the current filters/i)).toBeInTheDocument()
    })
  })
})
