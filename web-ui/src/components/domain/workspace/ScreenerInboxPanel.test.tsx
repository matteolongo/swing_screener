import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, act, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';

import ScreenerInboxPanel, { currencyFilterToRequest, ScreenerRunningPanel } from './ScreenerInboxPanel';
import { useScreenerStore } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

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

  it('renders result rows without the form when compact', async () => {
    useWorkspaceStore.setState({ selectedTicker: 'NVDA' });
    useScreenerStore.setState({
      lastResult: {
        asofDate: '2026-07-29',
        totalScreened: 1,
        dataFreshness: 'final_close',
        candidates: [{
          ticker: 'NVDA',
          close: 120,
          recommendation: {
            workflowStatus: 'ready',
            nextStep: { code: 'review_order' },
          },
          decisionSummary: { action: 'BUY_NOW' },
        }],
      } as never,
    });

    const { rerender } = renderWithProviders(<ScreenerInboxPanel compact />);

    const rail = await screen.findByTestId('symbol-rail-list');
    expect(within(rail).getByText(t('recommendation.workflow.status.ready'))).toBeInTheDocument();
    expect(within(rail).getByText(t('recommendation.workflow.nextStep.review_order'))).toBeInTheDocument();
    expect(within(rail).queryByText('BUY_NOW')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /NVDA/i })).toHaveAttribute('aria-current', 'true');
    expect(screen.queryByRole('button', { name: 'Advanced filters' })).not.toBeInTheDocument();

    const mountedFormToggle = await screen.findByRole('button', {
      name: 'Advanced filters',
      hidden: true,
    });
    expect(mountedFormToggle.closest('[hidden]')).toHaveClass('h-full', 'min-h-0');
    rerender(<ScreenerInboxPanel compact={false} />);
    expect(screen.getByRole('button', { name: 'Advanced filters' })).toBe(mountedFormToggle);
  });
});
