import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { renderWithProviders, screen, waitFor } from '@/test/utils'
import { server } from '@/test/mocks/server'
import SocialAnalysisModal from './SocialAnalysisModal'

type AnalyzeRequestBody = {
  symbol?: string
  max_events?: number
  lookback_hours?: number
}

function buildResponse(symbol: string, lookbackHours: number) {
  return {
    status: 'ok' as const,
    symbol,
    providers: ['reddit'],
    sentiment_analyzer: 'keyword',
    lookback_hours: lookbackHours,
    last_execution_at: '2026-02-17T00:00:00Z',
    sample_size: 1,
    sentiment_score: 0.2,
    sentiment_confidence: 0.9,
    attention_score: 1.1,
    attention_z: 0.5,
    hype_score: 0.1,
    source_breakdown: { reddit: 1 },
    reasons: [],
    raw_events: [],
  }
}

describe('SocialAnalysisModal', () => {
  it('does not reuse previous lookback override when symbol changes', async () => {
    const requests: AnalyzeRequestBody[] = []

    server.use(
      http.post('*/api/social/analyze', async ({ request }) => {
        const body = (await request.json()) as AnalyzeRequestBody
        requests.push(body)
        const symbol = (body.symbol ?? 'AAPL').toUpperCase()
        const lookback = typeof body.lookback_hours === 'number' ? body.lookback_hours : 24
        return HttpResponse.json(buildResponse(symbol, lookback))
      }),
    )

    const { user, rerender } = renderWithProviders(
      <SocialAnalysisModal symbol="AAPL" onClose={() => {}} />,
    )

    await waitFor(() => {
      expect(requests.length).toBe(1)
    })

    await user.type(screen.getByLabelText(/lookback/i), '72')
    await user.click(screen.getByRole('button', { name: /refresh/i }))

    await waitFor(() => {
      expect(requests.length).toBe(2)
    })
    expect(requests[1]).toMatchObject({ symbol: 'AAPL', lookback_hours: 72 })

    rerender(<SocialAnalysisModal symbol="MSFT" onClose={() => {}} />)

    await waitFor(() => {
      expect(requests.length).toBe(3)
    })
    expect(requests[2]).toMatchObject({ symbol: 'MSFT' })
    expect(requests[2]).not.toHaveProperty('lookback_hours')
  })
})
