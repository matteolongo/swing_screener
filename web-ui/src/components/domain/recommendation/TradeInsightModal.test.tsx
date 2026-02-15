import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import TradeInsightModal from './TradeInsightModal';
import type { Recommendation } from '@/types/recommendation';

const mockRecommendation: Recommendation = {
  verdict: 'RECOMMENDED',
  reasonsShort: ['Good momentum', 'Strong trend'],
  reasonsDetailed: [
    {
      code: 'MOMENTUM_OK',
      message: 'Momentum looks good',
      severity: 'info',
      metrics: {},
    },
  ],
  risk: {
    entry: 100,
    stop: 95,
    target: 110,
    rr: 2.0,
    riskAmount: 500,
    riskPct: 0.01,
    positionSize: 10000,
    shares: 100,
  },
  costs: {
    commissionEstimate: 5,
    fxEstimate: 2,
    slippageEstimate: 3,
    totalCost: 10,
    feeToRiskPct: 0.02,
  },
  checklist: [
    {
      gateName: 'Momentum Gate',
      passed: true,
      explanation: 'Momentum is positive',
      rule: 'momentum_6m > 0',
    },
  ],
  education: {
    commonBiasWarning: 'Avoid chasing',
    whatToLearn: 'Learn about momentum',
    whatWouldMakeValid: ['Wait for pullback'],
  },
};

const mockRecommendationWithThesis: Recommendation = {
  ...mockRecommendation,
  thesis: {
    ticker: 'TEST',
    strategy: 'Momentum',
    entryType: 'Breakout',
    trendStatus: 'Uptrend',
    relativeStrength: 'Strong',
    regimeAlignment: true,
    volatilityState: 'Normal',
    riskReward: 2.5,
    setupQualityScore: 85,
    setupQualityTier: 'HIGH_QUALITY',
    institutionalSignal: true,
    priceActionQuality: 'Clean',
    safetyLabel: 'BEGINNER_FRIENDLY',
    personality: {
      trendStrength: 4,
      volatilityRating: 3,
      conviction: 4,
      complexity: 'Simple trend-following setup',
    },
    explanation: {
      whyQualified: ['Strong momentum', 'Above key moving averages'],
      whatCouldGoWrong: ['Market reversal', 'Earnings surprise'],
      setupType: 'Momentum breakout',
      keyInsight: 'This is a strong momentum play',
    },
    invalidationRules: [
      {
        ruleId: 'stop_loss',
        condition: 'Price falls below stop',
        metric: 'close',
        threshold: 95,
      },
    ],
    professionalInsight: 'Wait for pullback to enter',
  },
};

describe('TradeInsightModal', () => {
  it('renders with recommendation tab by default', () => {
    const onClose = vi.fn();
    renderWithProviders(
      <TradeInsightModal
        ticker="TEST"
        recommendation={mockRecommendation}
        currency="USD"
        onClose={onClose}
      />
    );

    expect(screen.getByText(/Trade Insight — TEST/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Recommendation/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Learn/i })).toBeInTheDocument();
  });

  it('shows thesis tab when thesis data exists', () => {
    const onClose = vi.fn();
    renderWithProviders(
      <TradeInsightModal
        ticker="TEST"
        recommendation={mockRecommendationWithThesis}
        currency="USD"
        onClose={onClose}
      />
    );

    expect(screen.getByRole('tab', { name: /Thesis/i })).toBeInTheDocument();
  });

  it('does not show thesis tab when thesis data is missing', () => {
    const onClose = vi.fn();
    renderWithProviders(
      <TradeInsightModal
        ticker="TEST"
        recommendation={mockRecommendation}
        currency="USD"
        onClose={onClose}
      />
    );

    expect(screen.queryByRole('tab', { name: /Thesis/i })).not.toBeInTheDocument();
  });

  it('displays recommendation section by default', () => {
    const onClose = vi.fn();
    renderWithProviders(
      <TradeInsightModal
        ticker="TEST"
        recommendation={mockRecommendation}
        currency="USD"
        onClose={onClose}
      />
    );

    expect(screen.getByText(/Checklist Gates/i)).toBeInTheDocument();
    expect(screen.getByText(/Momentum Gate/i)).toBeInTheDocument();
  });

  it('switches to thesis tab when defaultTab is thesis', () => {
    const onClose = vi.fn();
    renderWithProviders(
      <TradeInsightModal
        ticker="TEST"
        recommendation={mockRecommendationWithThesis}
        currency="USD"
        defaultTab="thesis"
        onClose={onClose}
      />
    );

    // Thesis content should be visible
    expect(screen.getByText(/Setup Quality Score/i)).toBeInTheDocument();
    expect(screen.getByText(/Trade Safety/i)).toBeInTheDocument();
  });

  it('shows empty state when no recommendation is provided', () => {
    const onClose = vi.fn();
    renderWithProviders(
      <TradeInsightModal
        ticker="TEST"
        currency="USD"
        onClose={onClose}
      />
    );

    // Learn tab should be available
    expect(screen.getByRole('tab', { name: /Learn/i })).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    const { user } = renderWithProviders(
      <TradeInsightModal
        ticker="TEST"
        recommendation={mockRecommendation}
        currency="USD"
        onClose={onClose}
      />
    );

    const closeButton = screen.getByRole('button', { name: /Close modal/i });
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
