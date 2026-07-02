import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import PositionsMiniCard from './PositionsMiniCard';
import type { PositionWithMetrics } from '@/features/portfolio/api';
import type { DailyReview } from '@/features/dailyReview/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────

function makePosition(overrides: Partial<PositionWithMetrics> = {}): PositionWithMetrics {
  return {
    ticker: 'AAPL',
    status: 'open',
    entryDate: '2026-01-01',
    entryPrice: 100,
    stopPrice: 90,
    shares: 10,
    positionId: 'POS-AAPL',
    pnl: 50,
    pnlPercent: 5,
    rNow: 1.2,
    entryValue: 1000,
    currentValue: 1050,
    perShareRisk: 10,
    totalRisk: 100,
    feesEur: 0,
    daysOpen: 4,
    timeStopWarning: false,
    priceSource: 'live',
    rUsesInitialRisk: false,
    ...overrides,
  };
}

function makeReview(overrides: Partial<DailyReview> = {}): DailyReview {
  return {
    watchlistNearTrigger: [],
    newCandidates: [],
    positionsAddOnCandidates: [],
    positionsHold: [],
    positionsUpdateStop: [],
    positionsClose: [],
    positionsExitSignal: [],
    pendingOrdersReview: [],
    summary: {
      totalPositions: 0,
      noAction: 0,
      updateStop: 0,
      closePositions: 0,
      exitSignal: 0,
      newCandidates: 0,
      addOnCandidates: 0,
      watchlistNearTrigger: 0,
      reviewDate: '2026-06-26',
    },
    ...overrides,
  };
}

// ─── Mocks ────────────────────────────────────────────────────────────────

let mockPositions: PositionWithMetrics[];
let mockReview: DailyReview | undefined;

vi.mock('@/features/portfolio/hooks', () => ({
  usePositions: () => ({ data: mockPositions }),
  useEarningsProximity: () => ({ data: undefined }),
}));

vi.mock('@/features/dailyReview/api', () => ({
  useDailyReview: () => ({ data: mockReview }),
}));

beforeEach(() => {
  mockPositions = [];
  mockReview = makeReview();
});

// ─── Tests ────────────────────────────────────────────────────────────────

describe('PositionsMiniCard', () => {
  it('shows one muted line when there are no open positions', () => {
    renderWithProviders(<PositionsMiniCard onTickerSelect={vi.fn()} />);
    expect(screen.getByText(t('todayPage.positionsCard.empty'))).toBeInTheDocument();
  });

  it('renders ticker, RChip and days-open for each open position; ticker click fires onTickerSelect', () => {
    mockPositions = [makePosition({ ticker: 'AAPL', rNow: 1.2, daysOpen: 4 })];
    const onTickerSelect = vi.fn();
    renderWithProviders(<PositionsMiniCard onTickerSelect={onTickerSelect} />);

    fireEvent.click(screen.getByText('AAPL'));
    expect(onTickerSelect).toHaveBeenCalledWith('AAPL');
    expect(screen.getByText('+1.20R')).toBeInTheDocument();
    expect(screen.getByText('4d')).toBeInTheDocument();
  });

  it('shows the TimeStopBadge when the position carries a time-stop warning', () => {
    mockPositions = [makePosition({ ticker: 'MSFT', daysOpen: 20, rNow: 0.3, timeStopWarning: true })];
    renderWithProviders(<PositionsMiniCard onTickerSelect={vi.fn()} />);
    expect(
      screen.getByText(t('todayPage.actionList.timeStopBadge', { days: '20', r: '+0.30' })),
    ).toBeInTheDocument();
  });

  it('shows the ExhaustionBadge sourced from the cached review positionsHold data, keyed by ticker', () => {
    mockPositions = [makePosition({ ticker: 'NVDA', positionId: 'POS-NVDA' })];
    mockReview = makeReview({
      positionsHold: [
        {
          positionId: 'POS-NVDA',
          ticker: 'NVDA',
          entryPrice: 100,
          stopPrice: 90,
          currentPrice: 120,
          rNow: 2,
          daysOpen: 10,
          timeStopWarning: false,
          reason: 'hold',
          exhaustionScore: 8.2,
          exhaustionLabel: 'exit',
          trimSuggestion: null,
        },
      ],
    });
    renderWithProviders(<PositionsMiniCard onTickerSelect={vi.fn()} />);
    expect(screen.getByTitle('Exhaustion: 8.2/10')).toBeInTheDocument();
  });

  it('shows the ExhaustionBadge sourced from positionsUpdateStop when the ticker is not held', () => {
    mockPositions = [makePosition({ ticker: 'AMZN', positionId: 'POS-AMZN' })];
    mockReview = makeReview({
      positionsUpdateStop: [
        {
          positionId: 'POS-AMZN',
          ticker: 'AMZN',
          entryPrice: 150,
          stopCurrent: 140,
          stopSuggested: 148,
          currentPrice: 160,
          rNow: 1,
          daysOpen: 6,
          timeStopWarning: false,
          reason: 'trail',
          exhaustionScore: 4.1,
          exhaustionLabel: 'watch',
        },
      ],
    });
    renderWithProviders(<PositionsMiniCard onTickerSelect={vi.fn()} />);
    expect(screen.getByTitle('Exhaustion: 4.1/10')).toBeInTheDocument();
  });

  it('shows a warning Trim badge when the hold row carries a trimSuggestion', () => {
    mockPositions = [makePosition({ ticker: 'TSLA', positionId: 'POS-TSLA' })];
    mockReview = makeReview({
      positionsHold: [
        {
          positionId: 'POS-TSLA',
          ticker: 'TSLA',
          entryPrice: 200,
          stopPrice: 180,
          currentPrice: 260,
          rNow: 3,
          daysOpen: 15,
          timeStopWarning: false,
          reason: 'hold',
          exhaustionScore: null,
          exhaustionLabel: null,
          trimSuggestion: { rThreshold: 2, rNow: 3 },
        },
      ],
    });
    renderWithProviders(<PositionsMiniCard onTickerSelect={vi.fn()} />);
    expect(screen.getByText(t('todayPage.positionsCard.trim'))).toBeInTheDocument();
  });

  it('omits the Trim badge when the hold row has no trimSuggestion', () => {
    mockPositions = [makePosition({ ticker: 'TSLA', positionId: 'POS-TSLA' })];
    mockReview = makeReview({
      positionsHold: [
        {
          positionId: 'POS-TSLA',
          ticker: 'TSLA',
          entryPrice: 200,
          stopPrice: 180,
          currentPrice: 260,
          rNow: 3,
          daysOpen: 15,
          timeStopWarning: false,
          reason: 'hold',
          exhaustionScore: null,
          exhaustionLabel: null,
          trimSuggestion: null,
        },
      ],
    });
    renderWithProviders(<PositionsMiniCard onTickerSelect={vi.fn()} />);
    expect(screen.queryByText(t('todayPage.positionsCard.trim'))).not.toBeInTheDocument();
  });

  it('shows the signed pnlPercent, sign-colored', () => {
    mockPositions = [makePosition({ ticker: 'AMD', pnlPercent: -3.4 })];
    renderWithProviders(<PositionsMiniCard onTickerSelect={vi.fn()} />);
    const pnl = screen.getByText('-3.4%');
    expect(pnl).toHaveClass('text-danger');
  });

  it('keeps the open-position count summary visible after collapsing', () => {
    mockPositions = [
      makePosition({ ticker: 'AAPL', positionId: 'POS-AAPL' }),
      makePosition({ ticker: 'MSFT', positionId: 'POS-MSFT' }),
    ];
    renderWithProviders(<PositionsMiniCard onTickerSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { expanded: true }));
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
