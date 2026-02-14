import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import RecommendationDetailsModal from '@/components/domain/recommendation/RecommendationDetailsModal'

describe('RecommendationDetailsModal', () => {
  it('renders recommendation sections and ratio percentages', () => {
    render(
      <RecommendationDetailsModal
        ticker="VALE"
        recommendation={{
          verdict: 'RECOMMENDED',
          reasonsShort: ['Signal active with valid stop'],
          reasonsDetailed: [],
          risk: {
            entry: 17.38,
            stop: 16.36,
            target: 19.42,
            rr: 2,
            riskAmount: 8.16,
            riskPct: 0.0082,
            positionSize: 139.04,
            shares: 8,
          },
          costs: {
            commissionEstimate: 0,
            fxEstimate: 0,
            slippageEstimate: 0.15,
            totalCost: 0.15,
            feeToRiskPct: 0.02,
          },
          checklist: [
            { gateName: 'rr_threshold', passed: true, explanation: 'RR >= 2.0' },
          ],
          education: {
            commonBiasWarning: 'Avoid chasing',
            whatToLearn: 'Prefer asymmetry',
            whatWouldMakeValid: [],
          },
        }}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('Recommendation — VALE')).toBeInTheDocument()
    expect(screen.getByText('Checklist Gates')).toBeInTheDocument()
    expect(screen.getByText('Risk & Costs')).toBeInTheDocument()
    expect(screen.getByText('+0.8%')).toBeInTheDocument()
    expect(screen.getByText('+2.0%')).toBeInTheDocument()
  })
})
