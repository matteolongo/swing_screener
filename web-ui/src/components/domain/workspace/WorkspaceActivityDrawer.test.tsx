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
  provider: null,
  dataAsOf: null,
  fetchedAt: null,
  cacheOrigin: null,
  missingInputs: [],
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
});
