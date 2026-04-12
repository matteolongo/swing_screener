import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import PracticeCardReveal from './PracticeCardReveal';
import type { PracticeCard } from '@/features/practice/types';

vi.mock('@/components/domain/workspace/DecisionSummaryCard', () => ({
  default: () => <div>Decision Summary Card</div>,
}));

vi.mock('@/components/domain/recommendation/sections/LearnSection', () => ({
  default: () => <div>Learn Section</div>,
}));

const card: PracticeCard = {
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
      drivers: {
        positives: [],
        negatives: [],
        warnings: [],
      },
    },
  },
  verdictBanner: 'TRADE_NOW',
  evidenceCards: [
    { label: 'trend', status: 'positive', summary: 'Trend is strong' },
  ],
  whatToLearn: {
    keyIdea: 'Wait for alignment.',
    commonMistake: 'Chasing the candle.',
    ruleToRemember: 'Risk first.',
  },
  exerciseState: 'revealed',
};

describe('PracticeCardReveal', () => {
  it('renders the decision summary and learning sections', () => {
    renderWithProviders(
      <PracticeCardReveal
        card={card}
        onRequestExecution={vi.fn()}
        onNext={vi.fn()}
        hasNext
      />,
    );

    expect(screen.getByText('Decision Summary Card')).toBeInTheDocument();
    expect(screen.getByText('Learn Section')).toBeInTheDocument();
  });

  it('calls next when the next candidate button is clicked', async () => {
    const onNext = vi.fn();
    const { user } = renderWithProviders(
      <PracticeCardReveal
        card={card}
        onRequestExecution={vi.fn()}
        onNext={onNext}
        hasNext
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Next Candidate' }));
    expect(onNext).toHaveBeenCalled();
  });
});
