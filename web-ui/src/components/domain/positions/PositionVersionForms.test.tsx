import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import type { Position } from '@/types/position';
import ClosePositionModalForm from './ClosePositionModalForm';
import PartialCloseModalForm from './PartialCloseModalForm';
import UpdateStopModalForm from './UpdateStopModalForm';

const position: Position = {
  positionId: 'POS-1', ticker: 'AAPL', status: 'open', entryDate: '2026-10-01',
  entryPrice: 100, stopPrice: 95, shares: 10, initialRisk: 5, version: 1,
};

vi.mock('@/features/portfolio/hooks', () => ({
  usePositionStopSuggestion: () => ({ data: undefined, isLoading: false }),
  useUpdateTrailMethodMutation: () => ({ mutateAsync: vi.fn() }),
}));

describe('reviewing changed position forms', () => {
  it('requires explicit review when a different position has the same version', () => {
    const onSubmit = vi.fn();
    const props = { isLoading: false, onClose: vi.fn(), onSubmit };
    const { rerender } = renderWithProviders(<ClosePositionModalForm {...props} position={position} />);
    fireEvent.change(screen.getByLabelText(t('positions.closeModal.exitPrice')), { target: { value: '111' } });
    rerender(<ClosePositionModalForm {...props} position={{ ...position, positionId: 'POS-2' }} />);
    fireEvent.click(screen.getByRole('button', { name: t('closePositionModal.confirmClose') }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: t('positions.concurrency.review') })).toBeVisible();
  });
  it.each([
    { Form: ClosePositionModalForm, field: 'positions.closeModal.exitPrice', submit: 'closePositionModal.confirmClose', value: '110' },
    { Form: PartialCloseModalForm, field: 'positions.partialCloseModal.priceLabel', submit: 'positions.partialCloseModal.submit', value: '110' },
    { Form: UpdateStopModalForm, field: 'positions.updateStopModal.newStopPrice', submit: 'common.actions.updateStop', value: '97' },
  ] as const)('preserves typed input and requires explicit review for $Form.name', ({ Form, field, submit, value }) => {
    const onSubmit = vi.fn();
    const props = { isLoading: false, onClose: vi.fn(), onSubmit };
    const { rerender } = renderWithProviders(<Form {...props} position={position} />);
    fireEvent.change(screen.getByLabelText(t(field)), { target: { value } });
    if (Form === PartialCloseModalForm) {
      fireEvent.change(screen.getByLabelText(t('positions.partialCloseModal.sharesLabel')), { target: { value: '3' } });
    }

    rerender(<Form {...props} position={{ ...position, shares: 5, stopPrice: 96, version: 2 }} />);

    expect(screen.getByLabelText(t(field))).toHaveValue(Number(value));
    expect(screen.getByRole('alert')).toHaveTextContent(position.positionId!);
    const submitForm = () => Form === ClosePositionModalForm
      ? fireEvent.click(screen.getByRole('button', { name: t(submit) }))
      : fireEvent.submit(screen.getByLabelText(t(field)).closest('form')!);
    submitForm();
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: t('positions.concurrency.review') }));
    submitForm();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 2 }));
  });
});
