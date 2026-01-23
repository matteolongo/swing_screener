import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import PositionsTable from '@/components/PositionsTable';
import theme from '@/lib/theme';
import type { Position } from '@/lib/types';

const basePosition: Position = {
  ticker: 'AAA',
  status: 'open',
  entry_date: '2026-01-01',
  entry_price: 10,
  stop_price: 9,
  shares: 1,
  notes: 'note',
  locked: false,
};

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('PositionsTable', () => {
  it('disables stop price when locked', () => {
    renderWithTheme(
      <PositionsTable
        positions={[{ ...basePosition, locked: true }]}
        onPositionChange={() => undefined}
        onToggleLock={() => undefined}
      />
    );

    expect(screen.getByTestId('stop-price-AAA')).toBeDisabled();
  });

  it('calls onPositionChange for status updates', async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();

    renderWithTheme(
      <PositionsTable
        positions={[basePosition]}
        onPositionChange={handleChange}
        onToggleLock={() => undefined}
      />
    );

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /closed/i }));

    expect(handleChange).toHaveBeenCalledWith('AAA', 'status', 'closed');
  });
});
