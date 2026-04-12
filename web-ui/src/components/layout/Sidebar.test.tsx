import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import Sidebar from './Sidebar';

describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the education-first navigation items', () => {
    renderWithProviders(<Sidebar />);

    expect(screen.getByText('Learn')).toBeInTheDocument();
    expect(screen.getByText('Practice')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Journal')).toBeInTheDocument();
    expect(screen.getByText('Method Settings')).toBeInTheDocument();
  });

  it('does not render the old primary navigation labels', () => {
    renderWithProviders(<Sidebar />);

    expect(screen.queryByText('Today')).not.toBeInTheDocument();
    expect(screen.queryByText('Book')).not.toBeInTheDocument();
    expect(screen.queryByText('Research')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Settings$/)).not.toBeInTheDocument();
  });
});
