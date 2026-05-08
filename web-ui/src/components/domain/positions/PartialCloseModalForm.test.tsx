import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import PartialCloseModalForm from './PartialCloseModalForm';
import { t } from '@/i18n/t';
import type { Position } from '@/features/portfolio/types';

const position: Position = {
  positionId: 'POS-001',
  ticker: 'AAPL',
  status: 'open',
  entryDate: '2026-01-01',
  entryPrice: 20.0,
  stopPrice: 18.0,
  shares: 10,
  initialRisk: 20.0,
  partialCloses: [],
  notes: '',
  tags: [],
};

describe('PartialCloseModalForm', () => {
  it('renders with default shares = 50% of position', () => {
    renderWithProviders(
      <PartialCloseModalForm
        position={position}
        isLoading={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    const sharesInput = screen.getByLabelText(t('positions.partialCloseModal.sharesLabel'));
    expect((sharesInput as HTMLInputElement).value).toBe('5');
  });

  it('calls onSubmit with correct shares and price', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <PartialCloseModalForm
        position={position}
        isLoading={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );
    const priceInput = screen.getByLabelText(t('positions.partialCloseModal.priceLabel'));
    fireEvent.change(priceInput, { target: { value: '22.0' } });
    const form = screen.getByLabelText(t('positions.partialCloseModal.sharesLabel')).closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ sharesClosed: 5, price: 22.0 })
      );
    });
  });

  it('shows validation error when shares >= total', async () => {
    renderWithProviders(
      <PartialCloseModalForm
        position={position}
        isLoading={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    const sharesInput = screen.getByLabelText(t('positions.partialCloseModal.sharesLabel'));
    fireEvent.change(sharesInput, { target: { value: '10' } });
    const form = sharesInput.closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByText(t('positions.partialCloseModal.errorTooManyShares'))).toBeInTheDocument();
    });
  });

  it('shows live R-at-close preview', () => {
    renderWithProviders(
      <PartialCloseModalForm
        position={position}
        isLoading={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    const priceInput = screen.getByLabelText(t('positions.partialCloseModal.priceLabel'));
    fireEvent.change(priceInput, { target: { value: '22.0' } });
    // (22 - 20) / (20 - 18) = 1.00R
    expect(screen.getByText(/1\.00R/i)).toBeInTheDocument();
  });
});
