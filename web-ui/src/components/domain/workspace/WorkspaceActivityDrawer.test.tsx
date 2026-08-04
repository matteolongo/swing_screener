import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { WorkspaceActivity, WorkspaceActivityPhase } from '@/features/workspaceData/types';
import { t } from '@/i18n/t';
import { renderWithProviders } from '@/test/utils';
import WorkspaceActivityDrawer from './WorkspaceActivityDrawer';

function activity(
  requestId: string,
  phase: WorkspaceActivityPhase,
  announced = true,
): WorkspaceActivity {
  return {
    requestId,
    ticker: 'AAPL',
    selectionVersion: 1,
    sourceId: 'prices',
    phase,
    startedAt: '2026-07-29T09:00:00Z',
    finishedAt: phase === 'active' ? null : '2026-07-29T09:01:00Z',
    provider: 'polygon',
    message: phase === 'failed' ? 'Price history is unavailable' : null,
    retryable: phase === 'failed',
    pipelineStep: 'fetch-candles',
    announced,
  };
}

describe('WorkspaceActivityDrawer', () => {
  it('shows every request lifecycle and its request ID', () => {
    const phases: WorkspaceActivityPhase[] = [
      'active',
      'completed',
      'partial',
      'failed',
      'discarded',
    ];
    renderWithProviders(
      <WorkspaceActivityDrawer
        activities={phases.map((phase) => activity(`request-${phase}`, phase))}
      />,
    );

    const status = screen.getByRole('status');
    for (const phase of phases) {
      expect(status).toHaveTextContent(t(`workspacePage.data.activityPhases.${phase}`));
      expect(status).toHaveTextContent(`request-${phase}`);
    }
  });

  it('announces a new failure once while keeping persistent content as status', () => {
    const onMarkAnnounced = vi.fn();
    const failed = activity('request-failed', 'failed', false);
    const { rerender } = renderWithProviders(
      <WorkspaceActivityDrawer
        activities={[failed]}
        onMarkAnnounced={onMarkAnnounced}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Price history is unavailable');
    expect(screen.getByRole('status')).toHaveTextContent('Price history is unavailable');
    expect(onMarkAnnounced).toHaveBeenCalledWith('request-failed');

    rerender(
      <WorkspaceActivityDrawer
        activities={[{ ...failed, announced: true }]}
        onMarkAnnounced={onMarkAnnounced}
      />,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Price history is unavailable');
  });

  it('retries by source and dismisses by request ID', async () => {
    const onRetry = vi.fn();
    const onDismiss = vi.fn();
    const { user } = renderWithProviders(
      <WorkspaceActivityDrawer
        activities={[activity('request-failed', 'failed')]}
        onRetry={onRetry}
        onDismiss={onDismiss}
      />,
    );

    await user.click(screen.getByRole('button', { name: t('workspacePage.data.retry') }));
    await user.click(screen.getByRole('button', { name: t('workspacePage.data.dismiss') }));

    expect(onRetry).toHaveBeenCalledWith('prices');
    expect(onDismiss).toHaveBeenCalledWith('request-failed');
  });
});
