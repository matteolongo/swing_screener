import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import CandidateOrderModal from '@/components/domain/orders/CandidateOrderModal'

const risk = {
  accountSize: 50000,
  riskPct: 0.01,
  maxPositionPct: 0.6,
  minShares: 1,
  kAtr: 2,
  minRr: 2,
  maxFeeRiskPct: 0.2,
}

describe('CandidateOrderModal', () => {
  it('disables create action for not recommended candidate', () => {
    render(
      <CandidateOrderModal
        candidate={{
          ticker: 'VALE',
          entry: 17.38,
          stop: 16.36,
          shares: 8,
          recommendation: {
            verdict: 'NOT_RECOMMENDED',
            reasonsShort: ['RR below threshold'],
            reasonsDetailed: [],
            risk: {
              entry: 17.38,
              stop: 16.36,
              target: 19.42,
              rr: 1.0,
              riskAmount: 8.16,
              riskPct: 0.0082,
              positionSize: 139.04,
              shares: 8,
            },
            costs: {
              commissionEstimate: 0,
              fxEstimate: 0,
              slippageEstimate: 0,
              totalCost: 0,
              feeToRiskPct: 0.02,
            },
            checklist: [],
            education: {
              commonBiasWarning: 'Do not chase',
              whatToLearn: 'Wait for better RR',
              whatWouldMakeValid: ['Raise target'],
            },
          },
        }}
        risk={risk}
        defaultNotes="From daily review"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    )

    const button = screen.getByRole('button', { name: 'Create Order' })
    expect(button).toBeDisabled()
  })
})
