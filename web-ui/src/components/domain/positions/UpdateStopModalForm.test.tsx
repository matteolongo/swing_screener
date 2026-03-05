import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UpdateStopModalForm from '@/components/domain/positions/UpdateStopModalForm';

const { usePositionStopSuggestionMock } = vi.hoisted(() => ({
  usePositionStopSuggestionMock: vi.fn(),
}));

vi.mock('@/features/portfolio/hooks', () => ({
  usePositionStopSuggestion: usePositionStopSuggestionMock,
}));

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

    render(
      <UpdateStopModalForm
        position={{
          ticker: 'REP.MC',
          status: 'open',
          entryDate: '2026-03-03',
          entryPrice: 17.32,
          stopPrice: 17.7,
          shares: 5,
          positionId: 'POS-REP-1',
          notes: '',
        }}
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
});
