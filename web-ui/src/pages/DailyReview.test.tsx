import { beforeEach, describe, expect, it } from 'vitest'
import { act, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { renderWithProviders } from '@/test/utils'
import { server } from '@/test/mocks/server'
import { useConfigStore } from '@/stores/configStore'
import { DEFAULT_CONFIG } from '@/types/config'
import DailyReview from './DailyReview'

const mockDailyReview = {
  new_candidates: [
    {
      ticker: 'VALE',
      signal: 'breakout',
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
    },
  ],
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
    review_date: '2026-02-12',
  },
}

describe('DailyReview Page', () => {
  beforeEach(() => {
    useConfigStore.setState({
      config: DEFAULT_CONFIG,
    })

    server.use(
      http.get('*/api/daily-review', () => HttpResponse.json(mockDailyReview))
    )
  })

  it('renders glossary blocks and help-labeled table columns', async () => {
    renderWithProviders(<DailyReview />)

    await waitFor(() => {
      expect(screen.getByText('Daily Review Glossary')).toBeInTheDocument()
      expect(screen.getByText('Stop Management Glossary')).toBeInTheDocument()
      expect(screen.getByText('R:R')).toBeInTheDocument()
      expect(screen.getAllByText('R Now').length).toBeGreaterThan(0)
    })
  })

  it('shows non-zero ratio percentages in recommendation risk panel', async () => {
    const { user } = renderWithProviders(<DailyReview />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Recommendation details for VALE/i })).toBeInTheDocument()
    })

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /Recommendation details for VALE/i }))
    })

    await waitFor(() => {
      expect(screen.getByText(/Recommendation — VALE/i)).toBeInTheDocument()
    })

    await act(async () => {
      await user.click(screen.getByText('Risk & Costs'))
    })

    await waitFor(() => {
      expect(screen.getByText('+0.8%')).toBeInTheDocument()
      expect(screen.getByText('+2.0%')).toBeInTheDocument()
    })
  })
})
