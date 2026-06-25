import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderWithProviders as render, screen, waitFor } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { API_BASE_URL } from '@/lib/api';
import NarrativeAnalysisCard from './NarrativeAnalysisCard';
import type { SymbolIntelligence } from '@/features/intelligence/types';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import { t } from '@/i18n/t';

const baseIntelligence: SymbolIntelligence = {
  symbol: 'AAPL',
  generatedAt: '2026-05-26T10:00:00Z',
  action: 'BUY_NOW',
  conviction: 'high',
  catalystUrgency: 'none',
  summaryLine: 'AAPL broke out on strong volume after earnings beat.',
  narrative: '**What to do:** Enter near $182. **Watch for:** Volume drying up.',
  upcomingEvents: [],
  positionSignal: null,
  sources: [],
};

const baseCandidate: SymbolAnalysisCandidate = {
  ticker: 'AAPL',
  currency: 'USD',
  decisionSummary: {
    symbol: 'AAPL',
    action: 'BUY_NOW',
    conviction: 'high',
    technicalLabel: 'strong',
    fundamentalsLabel: 'neutral',
    valuationLabel: 'fair',
    catalystLabel: 'active',
    whyNow: 'Breakout.',
    whatToDo: 'Buy.',
    mainRisk: 'Market correction.',
    tradePlan: { entry: 182.40, stop: 174.20, target: 204.00, rr: 2.6 },
    valuationContext: { method: 'earnings_multiple' },
    drivers: { positives: [], negatives: [], warnings: ['Watch China exposure'] },
    explanation: undefined,
    catalystSummary: null,
    catalystSources: [],
  },
};

describe('NarrativeAnalysisCard', () => {
  it('renders summaryLine as the lead sentence', () => {
    render(<NarrativeAnalysisCard intelligence={baseIntelligence} />);
    expect(screen.getByText('AAPL broke out on strong volume after earnings beat.')).toBeInTheDocument();
  });

  it('renders narrative markdown content', () => {
    render(<NarrativeAnalysisCard intelligence={baseIntelligence} />);
    expect(screen.getByText(/What to do:/)).toBeInTheDocument();
    expect(screen.getByText(/Watch for:/)).toBeInTheDocument();
  });

  it('does not render a duplicate trade plan grid', () => {
    render(<NarrativeAnalysisCard intelligence={baseIntelligence} candidate={baseCandidate} />);
    // Trade plan is shown in the workspace header, not inside this card
    expect(screen.queryByText('2.60x')).toBeNull();
  });

  it('signals detail section is collapsed by default', () => {
    render(<NarrativeAnalysisCard intelligence={baseIntelligence} candidate={baseCandidate} />);
    const details = document.querySelector('details');
    expect(details).not.toBeNull();
    expect(details?.hasAttribute('open')).toBe(false);
  });

  it('renders warnings when present', () => {
    render(<NarrativeAnalysisCard intelligence={baseIntelligence} candidate={baseCandidate} />);
    expect(screen.getByText('Watch China exposure')).toBeInTheDocument();
  });

  it('does not render warnings section when no warnings', () => {
    const candidateNoWarnings: SymbolAnalysisCandidate = {
      ...baseCandidate,
      decisionSummary: {
        ...baseCandidate.decisionSummary!,
        drivers: { positives: [], negatives: [], warnings: [] },
      },
    };
    render(<NarrativeAnalysisCard intelligence={baseIntelligence} candidate={candidateNoWarnings} />);
    expect(screen.queryByText('Watch China exposure')).toBeNull();
  });

  it('does not render a competing action banner verdict', () => {
    const buyNowIntelligence: SymbolIntelligence = {
      ...baseIntelligence,
      action: 'BUY_NOW',
    };
    const watchCandidate: SymbolAnalysisCandidate = {
      ...baseCandidate,
      decisionSummary: {
        ...baseCandidate.decisionSummary!,
        action: 'WATCH',
      },
    };
    render(<NarrativeAnalysisCard intelligence={buyNowIntelligence} candidate={watchCandidate} />);
    expect(screen.queryByText(/—\s*Buy Now/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(t('workspacePage.panels.analysis.intelligence.aiAnalysisTitle'), 'i'))
    ).toBeInTheDocument();
  });

  it('shows an inline second-opinion note when AI disagrees with the screener', () => {
    const buyNowIntelligence: SymbolIntelligence = {
      ...baseIntelligence,
      action: 'BUY_NOW',
    };
    const watchCandidate: SymbolAnalysisCandidate = {
      ...baseCandidate,
      decisionSummary: {
        ...baseCandidate.decisionSummary!,
        action: 'WATCH',
      },
    };
    render(<NarrativeAnalysisCard intelligence={buyNowIntelligence} candidate={watchCandidate} />);
    const note = t('workspacePage.panels.analysis.intelligence.secondOpinion', {
      aiAction: t('workspacePage.panels.analysis.decisionSummary.actions.buyNow'),
      screenerAction: t('workspacePage.panels.analysis.decisionSummary.actions.watch'),
    });
    expect(screen.getByText(note)).toBeInTheDocument();
  });

  it('shows no second-opinion note when actions agree', () => {
    render(<NarrativeAnalysisCard intelligence={baseIntelligence} candidate={baseCandidate} />);
    expect(screen.queryByText(/second opinion/i)).not.toBeInTheDocument();
  });

  it('renders "Data used by AI" panel with chips when inputsUsed has content', () => {
    const intelligenceWithInputs: SymbolIntelligence = {
      ...baseIntelligence,
      inputsUsed: { trade_plan: { entry: 285, rr: 2.5 } },
    };
    render(<NarrativeAnalysisCard intelligence={intelligenceWithInputs} />);
    expect(screen.getByText('Data used by AI')).toBeInTheDocument();
    expect(screen.getByText('entry:')).toBeInTheDocument();
  });

  it('renders candle patterns and skips object-valued inputs (no [object Object])', () => {
    const intelligenceWithObjects: SymbolIntelligence = {
      ...baseIntelligence,
      inputsUsed: {
        technical: { signal: 'breakout', sector_rotation_context: { sector: 'Tech', score: 1 } },
        candles: { patterns: 'hammer@at_pullback' },
      },
    };
    render(<NarrativeAnalysisCard intelligence={intelligenceWithObjects} />);
    expect(screen.getByText('patterns:')).toBeInTheDocument();
    expect(screen.getByText('hammer@at_pullback')).toBeInTheDocument();
    expect(screen.queryByText('[object Object]')).toBeNull();
    expect(screen.queryByText('sector rotation context:')).toBeNull();
  });

  it('does not render "Data used by AI" panel when inputsUsed is empty', () => {
    const intelligenceEmptyInputs: SymbolIntelligence = {
      ...baseIntelligence,
      inputsUsed: {},
    };
    render(<NarrativeAnalysisCard intelligence={intelligenceEmptyInputs} />);
    expect(screen.queryByText('Data used by AI')).toBeNull();
  });

  it('renders confidenceNotes from explanation when present, not drivers.warnings', () => {
    const candidateWithNotes: SymbolAnalysisCandidate = {
      ...baseCandidate,
      decisionSummary: {
        ...baseCandidate.decisionSummary!,
        drivers: { positives: [], negatives: [], warnings: ['Should not appear'] },
        explanation: {
          summaryLine: 'Test summary',
          whyItQualified: ['Qualified reason'],
          whyNow: ['Timing reason'],
          mainRisks: ['Risk item'],
          whatInvalidatesIt: ['Invalidation scenario'],
          nextBestAction: 'Next action',
          confidenceNotes: ['Confidence note shown'],
        },
      },
    };
    render(<NarrativeAnalysisCard intelligence={baseIntelligence} candidate={candidateWithNotes} />);
    expect(screen.getByText('Confidence note shown')).toBeInTheDocument();
    expect(screen.queryByText('Should not appear')).toBeNull();
  });
});

describe('NarrativeAnalysisCard — new structured fields', () => {
  const richIntelligence: SymbolIntelligence = {
    ...baseIntelligence,
    priceHook: 'Tight consolidation near 52w high with sector tailwind.',
    keyNumbers: [
      { label: 'SMA20', value: '€266', sentiment: 'bullish' },
      { label: 'Valuation', value: 'expensive', sentiment: 'bearish' },
      { label: 'RS vs benchmark', value: '+11.3%', sentiment: 'bullish' },
    ],
    riskFactors: ['Valuation stretched vs fair value.', 'No catalyst snapshot cached.'],
    predictionBullets: [
      { direction: 'bullish', reason: 'SMA20 absorbs pullback.', reference: 'SMA20 support' },
      { direction: 'bearish', reason: 'Valuation caps upside.', reference: 'fair value range' },
    ],
    pastTradesContext: 'Prior stop at €247 — that level is now key support.',
  };

  it('renders price hook section', () => {
    render(<NarrativeAnalysisCard intelligence={richIntelligence} />);
    expect(screen.getByText(/Why now/i)).toBeInTheDocument();
    expect(screen.getByText('Tight consolidation near 52w high with sector tailwind.')).toBeInTheDocument();
  });

  it('renders key numbers chips', () => {
    render(<NarrativeAnalysisCard intelligence={richIntelligence} />);
    expect(screen.getByText(/Key numbers/i)).toBeInTheDocument();
    expect(screen.getByText('SMA20')).toBeInTheDocument();
    expect(screen.getByText('€266')).toBeInTheDocument();
    expect(screen.getByText('Valuation')).toBeInTheDocument();
  });

  it('renders prediction bullets with direction', () => {
    render(<NarrativeAnalysisCard intelligence={richIntelligence} />);
    expect(screen.getByText(/Prediction/i)).toBeInTheDocument();
    expect(screen.getByText('SMA20 absorbs pullback.')).toBeInTheDocument();
    expect(screen.getByText('SMA20 support')).toBeInTheDocument();
  });

  it('renders risk factors', () => {
    render(<NarrativeAnalysisCard intelligence={richIntelligence} />);
    expect(screen.getByText(/Risks/i)).toBeInTheDocument();
    expect(screen.getByText('Valuation stretched vs fair value.')).toBeInTheDocument();
  });

  it('renders past trades context', () => {
    render(<NarrativeAnalysisCard intelligence={richIntelligence} />);
    expect(screen.getByText(/Past trades on/i)).toBeInTheDocument();
    expect(screen.getByText('Prior stop at €247 — that level is now key support.')).toBeInTheDocument();
  });

  it('does not render new sections when fields absent (old cache)', () => {
    render(<NarrativeAnalysisCard intelligence={baseIntelligence} />);
    expect(screen.queryByText(/Why now/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Key numbers/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Prediction/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Past trades on/i)).not.toBeInTheDocument();
  });

  it('renders the position move explanation when present', () => {
    render(
      <NarrativeAnalysisCard
        intelligence={{
          ...baseIntelligence,
          positionMoveExplanation: {
            direction: 'down',
            summary: 'Down since entry on a sector selloff.',
            drivers: [{ label: 'Sector selloff', detail: 'Semis sold off on rate fears.' }],
          },
        }}
      />,
    );
    expect(
      screen.getByText(t('workspacePage.panels.analysis.intelligence.positionMove.title')),
    ).toBeInTheDocument();
    expect(screen.getByText('Down since entry on a sector selloff.')).toBeInTheDocument();
    expect(screen.getByText(/Semis sold off on rate fears\./)).toBeInTheDocument();
  });

  it('does not render the position move explanation when absent', () => {
    render(<NarrativeAnalysisCard intelligence={baseIntelligence} />);
    expect(
      screen.queryByText(t('workspacePage.panels.analysis.intelligence.positionMove.title')),
    ).not.toBeInTheDocument();
  });
});

describe('NarrativeAnalysisCard — pre-open outlook & thesis delta', () => {
  it('renders the pre-open card only when preOpenOutlook is present', () => {
    render(
      <NarrativeAnalysisCard
        intelligence={{
          ...baseIntelligence,
          preOpenOutlook: {
            gapDirection: 'gap_up',
            magnitude: 'moderate',
            primaryDriver: { summary: 'Overnight earnings beat.', sourceUrl: 'https://x' },
            actionAtOpen: 'Let it open, do not chase.',
            stopGapPlan: 'Exit at open if it gaps below the stop.',
            confidence: 'medium',
          },
        }}
      />,
    );
    expect(
      screen.getByText(t('workspacePage.panels.analysis.intelligence.preOpen.title')),
    ).toBeInTheDocument();
    expect(screen.getByText('Overnight earnings beat.')).toBeInTheDocument();
    expect(screen.getByText('Let it open, do not chase.')).toBeInTheDocument();
    expect(screen.getByText('Exit at open if it gaps below the stop.')).toBeInTheDocument();
  });

  it('does not render the pre-open card when absent', () => {
    render(<NarrativeAnalysisCard intelligence={baseIntelligence} />);
    expect(
      screen.queryByText(t('workspacePage.panels.analysis.intelligence.preOpen.title')),
    ).not.toBeInTheDocument();
  });

  it('renders the thesis-delta status badge and summary', () => {
    render(
      <NarrativeAnalysisCard
        intelligence={{
          ...baseIntelligence,
          thesisDelta: {
            status: 'weakening',
            summary: 'Momentum is fading versus last week.',
            whatPlayedOut: ['Breakout flagged last run did not hold'],
          },
        }}
      />,
    );
    expect(
      screen.getByText(t('workspacePage.panels.analysis.intelligence.thesisDelta.status.weakening')),
    ).toBeInTheDocument();
    expect(screen.getByText('Momentum is fading versus last week.')).toBeInTheDocument();
    expect(screen.getByText('Breakout flagged last run did not hold')).toBeInTheDocument();
  });
});

describe('NarrativeAnalysisCard — analysis timeline', () => {
  it('renders prior analyses from the history endpoint, newest-first', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/intelligence/:ticker/history`, () =>
        HttpResponse.json({
          entries: [
            {
              generated_at: '2026-06-25T08:00:00Z',
              action: 'MANAGE_ONLY',
              conviction: 'medium',
              summary_line: 'Hold into the open.',
              watch_for: ['gap risk'],
              pre_open_outlook: null,
            },
            {
              generated_at: '2026-06-18T08:00:00Z',
              action: 'BUY_NOW',
              conviction: 'high',
              summary_line: 'Initial breakout entry.',
              watch_for: [],
              pre_open_outlook: null,
            },
          ],
        }),
      ),
    );
    render(<NarrativeAnalysisCard intelligence={baseIntelligence} />);
    expect(
      screen.getByText(t('workspacePage.panels.analysis.intelligence.timeline.title')),
    ).toBeInTheDocument();
    expect(await screen.findByText('Hold into the open.')).toBeInTheDocument();
    expect(screen.getByText('Initial breakout entry.')).toBeInTheDocument();
    expect(screen.getByText('2026-06-25')).toBeInTheDocument();
  });

  it('shows the empty state when there is no history', async () => {
    render(<NarrativeAnalysisCard intelligence={baseIntelligence} />);
    await waitFor(() =>
      expect(
        screen.getByText(t('workspacePage.panels.analysis.intelligence.timeline.empty')),
      ).toBeInTheDocument(),
    );
  });
});
