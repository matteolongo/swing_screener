import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClosePositionModalForm from '@/components/domain/positions/ClosePositionModalForm';
import { t } from '@/i18n/t';

const openPosition = {
  ticker: 'ENGI.PA',
  status: 'open' as const,
  entryDate: '2026-03-03',
  entryPrice: 26.92,
  stopPrice: 26.5,
  shares: 3,
  positionId: 'POS-ENGI-1',
  notes: '',
};

describe('ClosePositionModalForm', () => {
  it('submits optional fee when provided', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <ClosePositionModalForm
        position={openPosition}
        isLoading={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText('Fee (EUR, optional)'), '4.90');
    await user.type(screen.getByLabelText('Reason'), 'Manual close after alert');
    const form = screen.getByRole('button', { name: t('closePositionModal.confirmClose') }).closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        exitPrice: 26.92,
        feeEur: 4.9,
        reason: 'Manual close after alert',
        lesson: undefined,
        tags: [],
      });
    });
  });

  it('shows tag chips after filling close price', () => {
    render(
      <ClosePositionModalForm
        position={openPosition}
        isLoading={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText(t('tradeTags.stepTitle'))).toBeInTheDocument();
    expect(screen.getByText(t('tradeTags.breakout'))).toBeInTheDocument();
  });

  it('submits selected tags with close request', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <ClosePositionModalForm
        position={openPosition}
        isLoading={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByText(t('tradeTags.breakout')));
    await user.click(screen.getByRole('button', { name: t('closePositionModal.confirmClose') }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        tags: ['breakout'],
      }));
    });
  });

  it('submits empty tags when skipped', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <ClosePositionModalForm
        position={openPosition}
        isLoading={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByText(t('tradeTags.breakout')));
    await user.click(screen.getByRole('button', { name: t('closePositionModal.skipTags') }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        tags: [],
      }));
    });
  });
});
