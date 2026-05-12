import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UpdateStopModalForm from '@/components/domain/positions/UpdateStopModalForm';
import { t } from '@/i18n/t';

const { usePositionStopSuggestionMock, useUpdateTrailMethodMutationMock } = vi.hoisted(() => ({
  usePositionStopSuggestionMock: vi.fn(),
  useUpdateTrailMethodMutationMock: vi.fn(),
}));

const { computePositionStopSuggestionMock } = vi.hoisted(() => ({
  computePositionStopSuggestionMock: vi.fn(),
}));

vi.mock('@/features/portfolio/hooks', () => ({
  usePositionStopSuggestion: usePositionStopSuggestionMock,
  useUpdateTrailMethodMutation: useUpdateTrailMethodMutationMock,
}));

vi.mock('@/features/portfolio/api', () => ({
  computePositionStopSuggestion: computePositionStopSuggestionMock,
}));

const basePosition = {
  ticker: 'REP.MC',
  status: 'open' as const,
  entryDate: '2026-03-03',
  entryPrice: 17.32,
  stopPrice: 17.7,
  shares: 5,
  positionId: 'POS-REP-1',
  notes: '',
};

describe('UpdateStopModalForm', () => {
  it('rounds suggested stop to two decimals when applying suggestion', async () => {
    const user = userEvent.setup();

    usePositionStopSuggestionMock.mockReturnValue({
      data: {
        ticker: 'REP.MC',
        status: 'open',
        last: 20.7,
        entry: 17.32,
        stopOld: 17.7,
        stopSuggested: 17.754033548831938,
        shares: 5,
        rNow: 4.02,
        action: 'MOVE_STOP_UP',
        reason: 'Trail: R=4.02 >= 2.0 and SMA20 trail',
      },
      isLoading: false,
      error: null,
    });
    useUpdateTrailMethodMutationMock.mockReturnValue({ mutateAsync: vi.fn() });
    computePositionStopSuggestionMock.mockResolvedValue(null);

    render(
      <UpdateStopModalForm
        position={basePosition}
        isLoading={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, '17.8');
    await user.click(screen.getByRole('button', { name: 'Use Suggested' }));

    await waitFor(() => {
      expect(input.value).toBe('17.75');
    });
  });

  it('shows TrailMethodSelector with position trail method', () => {
    usePositionStopSuggestionMock.mockReturnValue({ data: null, isLoading: false, error: null });
    useUpdateTrailMethodMutationMock.mockReturnValue({ mutateAsync: vi.fn() });
    computePositionStopSuggestionMock.mockResolvedValue(null);

    render(
      <UpdateStopModalForm
        position={{ ...basePosition, trailMethod: 'sma20' }}
        isLoading={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText(t('positions.trailMethod.label'))).toBeInTheDocument();
    const combobox = screen.getByRole('combobox') as HTMLSelectElement;
    expect(combobox.value).toBe('sma20');
  });

  it('recomputes stop suggestion when trail method changes to atr', async () => {
    const user = userEvent.setup();

    usePositionStopSuggestionMock.mockReturnValue({ data: null, isLoading: false, error: null });
    useUpdateTrailMethodMutationMock.mockReturnValue({ mutateAsync: vi.fn() });
    computePositionStopSuggestionMock.mockResolvedValue(null);

    render(
      <UpdateStopModalForm
        position={{ ...basePosition, trailMethod: 'sma20' }}
        isLoading={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const combobox = screen.getByRole('combobox');
    await user.selectOptions(combobox, 'atr');

    await waitFor(() => {
      expect(computePositionStopSuggestionMock).toHaveBeenCalledWith(
        expect.objectContaining({ trailMethod: 'atr' }),
      );
    });
  });
});
