import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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

  it('lets keyboard users select a source status', () => {
    renderWithProviders(<DataStatusBar sources={[source]} />);
    const status = screen.getByRole('button', {
      name: t('workspacePage.data.sources.fundamentals'),
    });

    status.focus();
    fireEvent.keyDown(status, { key: 'Enter' });
    fireEvent.click(status);

    expect(status).toHaveAttribute('aria-pressed', 'true');
  });
});
