import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PositionReviewPanel from './PositionReviewPanel';
import * as intelligenceHooks from '@/features/intelligence/hooks';
import type { PositionReview } from '@/features/intelligence/positionReviewTypes';
import { renderWithProviders } from '@/test/utils';

vi.mock('@/features/intelligence/hooks', () => ({
  usePositionReviewMutation: vi.fn(),
}));

const review: PositionReview = {
  ticker: 'MNST',
  generatedAt: '2026-07-03T12:00:00Z',
  mode: 'position',
  suggestedAction: 'RAISE_STOP',
  thesisStatus: 'intact',
  moveExplanation: {
    summary: 'Earnings beat supports the move.',
    companyCatalystWeight: 55,
    sectorWeight: 0,
    marketMacroWeight: 20,
    technicalWeight: 25,
    drivers: ['Earnings beat supports demand.', 'Position is currently 2.25R from entry.'],
  },
  profitProtection: {
    currentR: 2.25,
    moveExtension: 'medium',
    trimAdvice: 'trim_25_percent',
    reason: 'Protect part of the gain while leaving room.',
  },
  stopAdvice: {
    currentStop: 92,
    suggestedStop: 109.5,
    method: 'trail_sma20',
    reason: 'SMA trail: protect profit after >2R.',
  },
  entryPlan: null,
  macroOverlay: {
    riskLevel: 'medium',
    technicalReliability: 'reduced',
    reason: 'Rates volatility can reduce technical follow-through.',
    affectedTimeframe: 'days',
  },
  evidenceUsed: [
    {
      label: 'Macro risk update',
      source: 'Example Macro',
      url: 'https://example.com/macro',
      date: '2026-07-03',
      summary: 'Rates volatility can reduce technical follow-through.',
      relevance: 'macro risk',
    },
  ],
  narrative: 'MNST: raise stop and protect profit.',
};

const position = {
  positionId: 'pos-mnst',
  ticker: 'MNST',
  entryPrice: 100,
  stopPrice: 92,
  shares: 10,
  currentPrice: 118,
  rNow: 2.25,
  daysOpen: 32,
} as never;

describe('PositionReviewPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(intelligenceHooks.usePositionReviewMutation).mockReturnValue({
      mutate: vi.fn(),
      data: null,
      isPending: false,
      isError: false,
      error: null,
    } as never);
  });

  it('runs a held position review with refresh setting', async () => {
    const mutate = vi.fn();
    vi.mocked(intelligenceHooks.usePositionReviewMutation).mockReturnValue({
      mutate,
      data: null,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    const { user } = renderWithProviders(<PositionReviewPanel ticker="MNST" position={position} />);

    await user.click(screen.getByLabelText('Use latest sources (slower)'));
    await user.click(screen.getByRole('button', { name: 'Review position' }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        ticker: 'MNST',
        positionId: 'pos-mnst',
        refreshSources: true,
      });
    });
  });

  it('renders move, profit, stop, macro, and evidence cards', () => {
    vi.mocked(intelligenceHooks.usePositionReviewMutation).mockReturnValue({
      mutate: vi.fn(),
      data: review,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    renderWithProviders(<PositionReviewPanel ticker="MNST" position={position} />);

    expect(screen.getByText('Why it moved')).toBeInTheDocument();
    expect(screen.getByText('Protect profit')).toBeInTheDocument();
    expect(screen.getByText('Stop advice')).toBeInTheDocument();
    expect(screen.getByText('Context note')).toBeInTheDocument();
    expect(screen.getByText('Evidence used')).toBeInTheDocument();
    expect(screen.getByText('Earnings beat supports the move.')).toBeInTheDocument();
    expect(screen.getByText('2.25R')).toBeInTheDocument();
    expect(screen.getByText('109.50')).toBeInTheDocument();
    expect(screen.getByText('Macro risk update')).toBeInTheDocument();
  });

  it('runs a non-held symbol review and renders the entry plan instead of position cards', async () => {
    const mutate = vi.fn();
    const symbolReview: PositionReview = {
      ...review,
      ticker: 'GOOG',
      mode: 'symbol',
      suggestedAction: 'ENTER',
      thesisStatus: 'intact',
      profitProtection: null,
      stopAdvice: null,
      entryPlan: {
        stance: 'ENTER',
        whatConfirms: ['Setup is ready now; the planned entry is actionable.'],
        whatInvalidates: ['A close below the planned stop invalidates the setup.'],
        reason: 'Technical setup is ready, high conviction, set up to buy now.',
      },
      narrative: 'GOOG: ENTER. Setup thesis is intact.',
    };
    vi.mocked(intelligenceHooks.usePositionReviewMutation).mockReturnValue({
      mutate,
      data: symbolReview,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    const { user } = renderWithProviders(<PositionReviewPanel ticker="GOOG" />);

    expect(screen.getByText('Review this setup')).toBeInTheDocument();
    expect(screen.getByText('Entry plan')).toBeInTheDocument();
    expect(screen.getByText('What confirms entry')).toBeInTheDocument();
    expect(screen.getByText(/A close below the planned stop invalidates the setup\./)).toBeInTheDocument();
    expect(screen.queryByText('Protect profit')).not.toBeInTheDocument();
    expect(screen.queryByText('Stop advice')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Review setup' }));
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ ticker: 'GOOG', positionId: null, refreshSources: false });
    });
  });

  it('does not show a prior ticker result or error after selection changes', () => {
    vi.mocked(intelligenceHooks.usePositionReviewMutation).mockReturnValue({
      mutate: vi.fn(),
      reset: vi.fn(),
      variables: { ticker: 'MNST', positionId: 'pos-mnst', refreshSources: false },
      data: review,
      isPending: false,
      isError: true,
      error: new Error('MNST review failed'),
    } as never);

    const { rerender } = renderWithProviders(<PositionReviewPanel ticker="MNST" position={position} />);
    expect(screen.getByText('MNST: raise stop and protect profit.')).toBeInTheDocument();
    expect(screen.getByText('MNST review failed')).toBeInTheDocument();

    rerender(<PositionReviewPanel ticker="AAPL" />);

    expect(screen.queryByText('MNST: raise stop and protect profit.')).not.toBeInTheDocument();
    expect(screen.queryByText('MNST review failed')).not.toBeInTheDocument();
  });
});
