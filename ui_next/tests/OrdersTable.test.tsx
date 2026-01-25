import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import OrdersTable from '@/components/OrdersTable';
import theme from '@/lib/theme';
import type { Order } from '@/lib/types';

const baseOrder: Order = {
  order_id: 'AAA-1',
  ticker: 'AAA',
  status: 'pending',
  order_type: 'BUY_LIMIT',
  limit_price: 10,
  quantity: 1,
  stop_price: 9,
  order_date: '2026-01-01',
  filled_date: '',
  entry_price: null,
  notes: '',
  locked: false,
};

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('OrdersTable', () => {
  it('disables inputs when locked', () => {
    renderWithTheme(
      <OrdersTable
        orders={[{ ...baseOrder, locked: true }]}
        onOrderChange={() => undefined}
        onToggleLock={() => undefined}
      />
    );

    const filledDate = screen.getByTestId('filled-date-AAA-1');
    expect(filledDate).toBeDisabled();
  });

  it('calls onOrderChange for status updates', async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();

    renderWithTheme(
      <OrdersTable
        orders={[baseOrder]}
        onOrderChange={handleChange}
        onToggleLock={() => undefined}
      />
    );

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /filled/i }));

    expect(handleChange).toHaveBeenCalledWith('AAA-1', 'status', 'filled');
  });
});
