import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';

import PortfolioPanel from '@/components/domain/workspace/PortfolioPanel';
import { renderWithProviders } from '@/test/utils';

vi.mock('@/components/domain/workspace/PortfolioTable', () => ({
  default: () => <div>Mock Portfolio Table</div>,
}));

describe('PortfolioPanel', () => {
  it('renders portfolio panel with table', () => {
    renderWithProviders(<PortfolioPanel />);

    expect(screen.getByText('Portfolio')).toBeInTheDocument();
    expect(screen.getByText('Mock Portfolio Table')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sync DeGiro' })).not.toBeInTheDocument();
  });
});
