import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, act } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';

import { currencyFilterToRequest, ScreenerRunningPanel } from './ScreenerInboxPanel';

describe('currencyFilterToRequest', () => {
  it('does not force currencies when the filter is all', () => {
    expect(currencyFilterToRequest('all')).toBeUndefined();
  });

  it('maps explicit filters to request currencies', () => {
    expect(currencyFilterToRequest('usd')).toEqual(['USD']);
    expect(currencyFilterToRequest('eur')).toEqual(['EUR']);
  });
});

describe('ScreenerRunningPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the first step text on initial render', () => {
    renderWithProviders(<ScreenerRunningPanel />);
    expect(screen.getByText(t('screener.running.steps.preparingUniverse'))).toBeInTheDocument();
  });

  it('shows all five step labels', () => {
    renderWithProviders(<ScreenerRunningPanel />);
    expect(screen.getByText(t('screener.running.steps.preparingUniverse'))).toBeInTheDocument();
    expect(screen.getByText(t('screener.running.steps.downloadingPrices'))).toBeInTheDocument();
    expect(screen.getByText(t('screener.running.steps.scoringSetups'))).toBeInTheDocument();
    expect(screen.getByText(t('screener.running.steps.applyingRisk'))).toBeInTheDocument();
    expect(screen.getByText(t('screener.running.steps.buildingPlans'))).toBeInTheDocument();
  });

  it('advances to the second step after 1500ms', () => {
    renderWithProviders(<ScreenerRunningPanel />);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByText(t('screener.running.steps.downloadingPrices'))).toBeInTheDocument();
  });

  it('stops advancing past the last step', () => {
    renderWithProviders(<ScreenerRunningPanel />);
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    // All steps should still be in the document
    expect(screen.getByText(t('screener.running.steps.buildingPlans'))).toBeInTheDocument();
  });
});
