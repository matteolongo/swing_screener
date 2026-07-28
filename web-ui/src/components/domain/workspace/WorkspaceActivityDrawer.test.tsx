import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { t } from '@/i18n/t';
import { renderWithProviders } from '@/test/utils';
import type { WorkspaceSourceState } from '@/features/workspaceData/types';
import WorkspaceActivityDrawer from './WorkspaceActivityDrawer';

const failedActivity: WorkspaceSourceState = {
  id: 'prices',
  ticker: 'AAPL',
  selectionVersion: 1,
  phase: 'failed',
  provider: 'polygon',
  dataAsOf: '2026-07-27',
  fetchedAt: '2026-07-27T20:00:00Z',
  cacheOrigin: 'memory',
  missingInputs: ['daily close'],
  error: { message: 'Price history is unavailable', retryable: true },
};

describe('WorkspaceActivityDrawer', () => {
  it('announces a persistent source failure and allows retry', async () => {
    const onRetry = vi.fn();
    const { user, rerender } = renderWithProviders(
      <WorkspaceActivityDrawer activities={[failedActivity]} onRetry={onRetry} />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(failedActivity.error!.message);
    await user.click(screen.getByRole('button', { name: t('workspacePage.data.retry') }));
    expect(onRetry).toHaveBeenCalledWith('prices');

    rerender(<WorkspaceActivityDrawer activities={[]} onRetry={onRetry} />);
    expect(screen.getByRole('status')).toHaveTextContent(failedActivity.error!.message);
  });

  it('shows selected-source provenance, freshness, diagnostics, and retry context', () => {
    renderWithProviders(
      <WorkspaceActivityDrawer
        activities={[failedActivity]}
        selectedSourceId="prices"
        onRetry={vi.fn()}
      />,
    );

    const detail = screen.getByTestId('workspace-source-detail');
    expect(detail).toHaveTextContent('polygon');
    expect(detail).toHaveTextContent('2026-07-27');
    expect(detail).toHaveTextContent(new Date(failedActivity.fetchedAt!).toLocaleString());
    expect(detail).toHaveTextContent('memory');
    expect(detail).toHaveTextContent('daily close');
    expect(detail).toHaveTextContent(failedActivity.error!.message);
    expect(screen.getByRole('button', { name: t('workspacePage.data.retry') })).toBeEnabled();
  });

  it('drops retained failures when the workspace selection changes', () => {
    const { rerender } = renderWithProviders(
      <WorkspaceActivityDrawer activities={[failedActivity]} />,
    );

    rerender(
      <WorkspaceActivityDrawer
        activities={[
          {
            ...failedActivity,
            ticker: 'MSFT',
            selectionVersion: 2,
            phase: 'loading',
            error: null,
          },
        ]}
      />,
    );

    expect(screen.queryByText(failedActivity.error!.message)).not.toBeInTheDocument();
  });

  it('keeps a dismissed failure hidden across parent rerenders until recovery or a new failure', async () => {
    const { user, rerender } = renderWithProviders(
      <WorkspaceActivityDrawer activities={[failedActivity]} />,
    );

    await user.click(screen.getByRole('button', { name: t('workspacePage.data.dismiss') }));
    rerender(<WorkspaceActivityDrawer activities={[{ ...failedActivity }]} />);
    expect(screen.queryByText(failedActivity.error!.message)).not.toBeInTheDocument();

    rerender(
      <WorkspaceActivityDrawer
        activities={[{ ...failedActivity, error: { message: 'A new price failure', retryable: true } }]}
      />,
    );
    expect(screen.getByText('A new price failure')).toBeInTheDocument();
  });
});
