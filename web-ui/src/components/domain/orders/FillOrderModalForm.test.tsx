import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FillOrderModalForm from '@/components/domain/orders/FillOrderModalForm';

describe('FillOrderModalForm', () => {
  it('allows merge fills without requiring a new stop price', async () => {
    const onSubmit = vi.fn();

    render(
      <FillOrderModalForm
        order={{
          orderId: 'ORD-REP-ADD',
          ticker: 'REP.MC',
          status: 'pending',
          orderType: 'BUY_LIMIT',
          quantity: 38,
          limitPrice: 21.8,
          stopPrice: null,
          orderDate: '2026-03-11',
          filledDate: '',
          entryPrice: null,
          notes: 'Add-on buy',
          orderKind: 'entry',
          parentOrderId: null,
          positionId: null,
          tif: 'GTC',
        }}
        hasOpenPositionForTicker
        isLoading={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(
      screen.getByText('This ticker already has an open position. Filling this buy will merge into it and keep the current stop.'),
    ).toBeInTheDocument();

    const form = screen.getByRole('button', { name: 'Fill Order' }).closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        filledPrice: 21.8,
        filledDate: expect.any(String),
        stopPrice: undefined,
        feeEur: undefined,
        fillFxRate: undefined,
      });
    });
  });
});
