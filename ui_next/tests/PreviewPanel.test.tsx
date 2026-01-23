import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import PreviewPanel from '@/components/PreviewPanel';
import theme from '@/lib/theme';
import type { PreviewDiff } from '@/lib/types';

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('PreviewPanel', () => {
  it('renders diff entries', () => {
    const preview: PreviewDiff = {
      diff: {
        orders: [{ order_id: 'AAA-1', changes: { status: ['pending', 'filled'] } }],
        positions: [{ ticker: 'AAA', changes: { stop_price: [10, 9.5] } }],
      },
      warnings: [],
    };

    renderWithTheme(<PreviewPanel preview={preview} />);

    expect(screen.getByText('AAA-1')).toBeInTheDocument();
    expect(screen.getByText('status: pending → filled')).toBeInTheDocument();
    expect(screen.getByText('AAA')).toBeInTheDocument();
    expect(screen.getByText('stop_price: 10 → 9.5')).toBeInTheDocument();
  });
});
