import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import ScreenerCandidateDetailsRow from './ScreenerCandidateDetailsRow';
import type { CandidateViewModel } from '@/features/screener/viewModel';
import type { ScreenerCandidate } from '@/features/screener/types';
import { t } from '@/i18n/t';

function makeVm(volumeRatio: number | null): CandidateViewModel {
  const original: ScreenerCandidate = {
    ticker: 'TEST',
    currency: 'USD',
    close: 100,
    sma20: 95,
    sma50: 90,
    sma200: 80,
    atr: 2,
    momentum6m: 0.1,
    momentum12m: 0.15,
    relStrength: 0.05,
    score: 0.8,
    confidence: 0.75,
    rank: 1,
    volumeRatio: volumeRatio ?? undefined,
  };
  return {
    ticker: 'TEST',
    currency: 'USD',
    name: 'Test Corp',
    sector: 'Technology',
    lastBar: '2026-05-05T00:00:00',
    close: 100,
    confidence: 0.75,
    rank: 1,
    priorityRank: 1,
    rawRank: 1,
    verdict: 'UNKNOWN',
    entry: null,
    stop: null,
    rr: null,
    riskUsd: null,
    score: 0.8,
    atr: 2,
    momentum6m: 0.1,
    momentum12m: 0.15,
    relStrength: 0.05,
    fundamentalsCoverageStatus: null,
    fundamentalsFreshnessStatus: null,
    fundamentalsSummary: null,
    fixes: [],
    sameSymbol: null,
    volumeRatio,
    original,
  };
}

describe('ScreenerCandidateDetailsRow — volume ratio', () => {
  it('shows volume ratio label when volumeRatio is present', () => {
    renderWithProviders(<ScreenerCandidateDetailsRow candidate={makeVm(1.87)} />);
    expect(screen.getByText(t('screener.details.volumeRatio.label'))).toBeInTheDocument();
  });

  it('shows strong label for ratio >= 1.5', () => {
    renderWithProviders(<ScreenerCandidateDetailsRow candidate={makeVm(1.87)} />);
    expect(screen.getByText(t('screener.details.volumeRatio.strong', { value: '1.87' }))).toBeInTheDocument();
  });

  it('shows weak label for ratio < 0.9', () => {
    renderWithProviders(<ScreenerCandidateDetailsRow candidate={makeVm(0.7)} />);
    expect(screen.getByText(t('screener.details.volumeRatio.weak', { value: '0.70' }))).toBeInTheDocument();
  });

  it('shows neutral label for ratio between 0.9 and 1.5', () => {
    renderWithProviders(<ScreenerCandidateDetailsRow candidate={makeVm(1.2)} />);
    expect(screen.getByText(t('screener.details.volumeRatio.neutral', { value: '1.20' }))).toBeInTheDocument();
  });

  it('does not show volume label when volumeRatio is null', () => {
    renderWithProviders(<ScreenerCandidateDetailsRow candidate={makeVm(null)} />);
    expect(screen.queryByText(t('screener.details.volumeRatio.label'))).not.toBeInTheDocument();
  });
});
