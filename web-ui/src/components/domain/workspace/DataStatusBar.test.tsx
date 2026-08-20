import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { t } from '@/i18n/t';
import { renderWithProviders } from '@/test/utils';
import type { WorkspaceSourceState } from '@/features/workspaceData/types';
import DataStatusBar from './DataStatusBar';

const source: WorkspaceSourceState = {
  id: 'fundamentals',
  ticker: 'AAPL',
  selectionVersion: 1,
  phase: 'fresh',
  provider: 'yfinance',
  dataAsOf: null,
  fetchedAt: '2026-07-27T18:30:00Z',
  cacheOrigin: 'network',
  missingInputs: [],
  error: null,
};

describe('DataStatusBar', () => {
  it('shows localized source, phase, provider, and formatted timestamp', () => {
    renderWithProviders(<DataStatusBar sources={[source]} />);

    expect(screen.getByText(t('workspacePage.data.sources.fundamentals'))).toBeInTheDocument();
    expect(screen.getByText(t('workspacePage.data.phases.fresh'))).toBeInTheDocument();
    expect(screen.getByText('yfinance')).toBeInTheDocument();
    expect(screen.getByText(new Date(source.fetchedAt!).toLocaleString())).toBeInTheDocument();
  });

  it('announces loading updates politely', () => {
    renderWithProviders(<DataStatusBar sources={[{ ...source, phase: 'loading' }]} />);
    expect(screen.getByTestId('workspace-data-status')).toHaveAttribute('aria-live', 'polite');
  });

  it('reports source activation to the visible-detail owner', async () => {
    const onSourceSelect = vi.fn();
    const { user } = renderWithProviders(
      <DataStatusBar sources={[source]} onSourceSelect={onSourceSelect} />,
    );
    const status = screen.getByRole('button', {
      name: t('workspacePage.data.sources.fundamentals'),
    });

    await user.click(status);
    expect(onSourceSelect).toHaveBeenLastCalledWith('fundamentals');

    status.focus();
    await user.keyboard('{Enter}');
    expect(onSourceSelect).toHaveBeenCalledTimes(2);

    await user.keyboard(' ');
    expect(onSourceSelect).toHaveBeenCalledTimes(3);
  });
});
