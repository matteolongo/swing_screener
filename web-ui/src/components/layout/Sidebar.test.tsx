import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import Sidebar from './Sidebar';

describe('Sidebar', () => {
  it('renders navigation-only items', () => {
    renderWithProviders(<Sidebar />);

    expect(screen.getByText('Decide')).toBeInTheDocument();
    expect(screen.getByText('Strategy')).toBeInTheDocument();
    expect(screen.getByText('Learn')).toBeInTheDocument();
    expect(screen.queryByText('Active Strategy')).not.toBeInTheDocument();
  });

  it('does not render strategy selectors or toggles', () => {
    renderWithProviders(<Sidebar />);

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});
