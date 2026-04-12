import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import ExecutionReadbackScreen from './ExecutionReadbackScreen';

describe('ExecutionReadbackScreen', () => {
  it('renders the three statement blocks', () => {
    renderWithProviders(
      <ExecutionReadbackScreen
        readback={{
          symbol: 'AAPL',
          entry: 101,
          stop: 96,
          target: 113,
          shares: 10,
          maxLoss: 50,
          maxLossPercent: 0.5,
          invalidationCondition: 'Price closes below 96.',
          thesisSummary: 'Momentum is strong.',
          checklist: [
            { id: '1', label: 'I understand my max loss', checked: false },
          ],
          allChecked: false,
        }}
        failedGateWarnings={['Invalidation: Needs a clearer stop']}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText('Momentum is strong.')).toBeInTheDocument();
    expect(screen.getByText(/Price closes below 96/i)).toBeInTheDocument();
    expect(screen.getByText(/50.00/i)).toBeInTheDocument();
  });

  it('keeps place trade disabled until all checklist items are checked', async () => {
    const { user } = renderWithProviders(
      <ExecutionReadbackScreen
        readback={{
          symbol: 'AAPL',
          entry: 101,
          stop: 96,
          target: 113,
          shares: 10,
          maxLoss: 50,
          maxLossPercent: 0.5,
          invalidationCondition: 'Price closes below 96.',
          thesisSummary: 'Momentum is strong.',
          checklist: [
            { id: '1', label: 'I understand my max loss', checked: false },
          ],
          allChecked: false,
        }}
        failedGateWarnings={[]}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const placeTrade = screen.getByRole('button', { name: 'Place Trade' });
    expect(placeTrade).toBeDisabled();

    await user.click(screen.getByRole('checkbox'));
    expect(placeTrade).toBeEnabled();
  });
});
