import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AnalysisCanvasPanel from '@/components/domain/workspace/AnalysisCanvasPanel';
import * as fundamentalsHooks from '@/features/fundamentals/hooks';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { renderWithProviders } from '@/test/utils';

vi.mock('@/features/fundamentals/hooks', () => ({
  useFundamentalSnapshotQuery: vi.fn(),
  useRefreshFundamentalSnapshotMutation: vi.fn(),
}));

describe('AnalysisCanvasPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState({
      selectedTicker: 'AAPL',
      selectedTickerSource: 'screener',
      analysisTab: 'fundamentals',
    });
  });

  it('runs fundamentals analysis for the selected symbol from the canvas', async () => {
    const mutate = vi.fn();

    vi.mocked(fundamentalsHooks.useFundamentalSnapshotQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: undefined,
    } as never);
    vi.mocked(fundamentalsHooks.useRefreshFundamentalSnapshotMutation).mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    const { user } = renderWithProviders(<AnalysisCanvasPanel />);

    expect(screen.getByText('No fundamentals snapshot available yet.')).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Run fundamentals analysis' }));
    });

    expect(mutate).toHaveBeenCalledWith('AAPL');
  });
});
