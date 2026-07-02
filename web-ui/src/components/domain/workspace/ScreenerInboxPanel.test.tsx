import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, act, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import ScreenerInboxPanel, { currencyFilterToRequest, ScreenerRunningPanel } from './ScreenerInboxPanel';

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

describe('ScreenerInboxPanel', () => {
  it('defaults to the collapsed beginner run summary instead of the full advanced filter form', async () => {
    renderWithProviders(<ScreenerInboxPanel />);

    expect(await screen.findByRole('button', { name: 'Advanced filters' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: t('screener.controls.actionFilter') })).not.toBeInTheDocument();
  });

  it('does not auto-select a candidate into the global drawer after a screener run completes', async () => {
    useWorkspaceStore.setState({ selectedTicker: null, selectedTickerSource: null });

    renderWithProviders(<ScreenerInboxPanel />);

    const runButton = await screen.findByRole('button', { name: t('screener.controls.run') });
    fireEvent.click(runButton);

    await screen.findByText('AAPL');

    expect(useWorkspaceStore.getState().selectedTicker).toBeNull();
  });
});
