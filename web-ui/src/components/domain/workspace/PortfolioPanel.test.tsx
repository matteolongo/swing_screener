import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';

import PortfolioPanel from '@/components/domain/workspace/PortfolioPanel';
import { renderWithProviders } from '@/test/utils';

vi.mock('@/components/domain/workspace/PortfolioTable', () => ({
  default: () => <div>Mock Portfolio Table</div>,
}));

vi.mock('@/features/portfolio/hooks', () => ({
  useSyncDegiroOrdersMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
  }),
  useDegiroStatusQuery: () => ({
    data: {
      available: false,
      detail: 'DeGiro setup missing.',
    },
    isSuccess: true,
    isError: false,
  }),
}));

describe('PortfolioPanel', () => {
  it('hides sync when DeGiro is unavailable and explains the impact', () => {
    renderWithProviders(<PortfolioPanel />);

    expect(screen.queryByRole('button', { name: 'Sync DeGiro' })).not.toBeInTheDocument();
    expect(screen.getByText('DeGiro sync is optional')).toBeInTheDocument();
    expect(screen.getByText(/Portfolio tracking still works manually/i)).toBeInTheDocument();
  });
});
