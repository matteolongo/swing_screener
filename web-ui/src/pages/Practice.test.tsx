import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import Practice from './Practice';

vi.mock('@/features/practice/usePracticeSession', () => ({
  usePracticeSession: () => ({
    reviewQuery: { isLoading: false, isError: false },
    session: {
      date: '2026-04-12',
      cards: [
        {
          candidate: {
            ticker: 'AAPL',
            currency: 'USD',
            signal: 'breakout',
            close: 100,
            entry: 101,
            stop: 96,
            shares: 10,
            rReward: 2,
            name: 'Apple',
            sector: 'Tech',
            recommendation: undefined,
            decisionSummary: {
              symbol: 'AAPL',
              action: 'BUY_NOW',
              conviction: 'high',
              technicalLabel: 'strong',
              fundamentalsLabel: 'strong',
              valuationLabel: 'fair',
              catalystLabel: 'active',
              whyNow: 'Fresh breakout',
              whatToDo: 'Enter',
              mainRisk: 'Failed breakout',
              tradePlan: {},
              valuationContext: { method: 'not_available' },
              drivers: { positives: [], negatives: [], warnings: [] },
            },
          },
          verdictBanner: 'TRADE_NOW',
          evidenceCards: [],
          whatToLearn: {
            keyIdea: 'Key idea',
            commonMistake: 'Mistake',
            ruleToRemember: 'Rule',
          },
          exerciseState: 'prompt',
        },
      ],
      currentIndex: 0,
      objective: 'Practice Today’s Setups',
    },
    currentCard: {
      candidate: {
        ticker: 'AAPL',
        currency: 'USD',
        signal: 'breakout',
        close: 100,
        entry: 101,
        stop: 96,
        shares: 10,
        rReward: 2,
        name: 'Apple',
        sector: 'Tech',
        recommendation: undefined,
        decisionSummary: {
          symbol: 'AAPL',
          action: 'BUY_NOW',
          conviction: 'high',
          technicalLabel: 'strong',
          fundamentalsLabel: 'strong',
          valuationLabel: 'fair',
          catalystLabel: 'active',
          whyNow: 'Fresh breakout',
          whatToDo: 'Enter',
          mainRisk: 'Failed breakout',
          tradePlan: {},
          valuationContext: { method: 'not_available' },
          drivers: { positives: [], negatives: [], warnings: [] },
        },
      },
      verdictBanner: 'TRADE_NOW',
      evidenceCards: [],
      whatToLearn: {
        keyIdea: 'Key idea',
        commonMistake: 'Mistake',
        ruleToRemember: 'Rule',
      },
      exerciseState: 'prompt',
    },
    answerExercise: vi.fn(),
    revealExplanation: vi.fn(),
    advance: vi.fn(),
  }),
}));

vi.mock('@/features/strategy/hooks', () => ({
  useActiveStrategyQuery: () => ({ data: { risk: { accountSize: 10000, riskPct: 0.01, maxPositionPct: 0.5, minShares: 1, kAtr: 2, minRr: 2, maxFeeRiskPct: 0.2 } } }),
}));

vi.mock('@/features/config/hooks', () => ({
  useConfigDefaultsQuery: () => ({ data: { risk: { accountSize: 10000, riskPct: 0.01, maxPositionPct: 0.5, minShares: 1, kAtr: 2, minRr: 2, maxFeeRiskPct: 0.2 } } }),
}));

vi.mock('@/components/domain/practice/PracticeCardExercise', () => ({
  default: () => <div>Practice Exercise</div>,
}));

describe('Practice Page', () => {
  it('renders the objective banner and exercise', () => {
    renderWithProviders(<Practice />);

    expect(screen.getByText('Practice Today’s Setups')).toBeInTheDocument();
    expect(screen.getByText('Practice Exercise')).toBeInTheDocument();
  });
});
