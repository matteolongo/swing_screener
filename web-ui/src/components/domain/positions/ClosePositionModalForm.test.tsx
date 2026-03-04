import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClosePositionModalForm from '@/components/domain/positions/ClosePositionModalForm';

describe('ClosePositionModalForm', () => {
  it('submits optional fee when provided', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <ClosePositionModalForm
        position={{
          ticker: 'ENGI.PA',
          status: 'open',
          entryDate: '2026-03-03',
          entryPrice: 26.92,
          stopPrice: 26.5,
          shares: 3,
          positionId: 'POS-ENGI-1',
          notes: '',
        }}
        isLoading={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText('Fee (EUR, optional)'), '4.90');
    await user.type(screen.getByLabelText('Reason'), 'Manual close after alert');
    const form = screen.getByRole('button', { name: 'Close Position' }).closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        exitPrice: 26.92,
        feeEur: 4.9,
        reason: 'Manual close after alert',
      });
    });
  });
});
