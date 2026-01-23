import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import RoutinePanel from '@/components/RoutinePanel';
import theme from '@/lib/theme';

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('RoutinePanel', () => {
  it('shows last run and buttons', () => {
    renderWithTheme(
      <RoutinePanel
        lastRun="2026-01-21"
        onRunScreening={() => undefined}
        onPreview={() => undefined}
        onApply={() => undefined}
        screening={null}
      />
    );

    expect(screen.getByText(/Last run: 2026-01-21/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run Screening/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Preview Changes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apply/i })).toBeInTheDocument();
  });
});
