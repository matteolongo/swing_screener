import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import Sidebar from './Sidebar';


describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should render primary navigation items', () => {
    renderWithProviders(<Sidebar />);

    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Book')).toBeInTheDocument();
    expect(screen.getByText('Research')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should not show old navigation items removed in revamp', () => {
    renderWithProviders(<Sidebar />);

    expect(screen.queryByText('Workspace')).not.toBeInTheDocument();
    expect(screen.queryByText('Daily Review')).not.toBeInTheDocument();
    expect(screen.queryByText('Intelligence')).not.toBeInTheDocument();
    expect(screen.queryByText('Fundamentals')).not.toBeInTheDocument();
    expect(screen.queryByText('Journal')).not.toBeInTheDocument();
    expect(screen.queryByText('Analytics')).not.toBeInTheDocument();
  });

  it('should not show strategy selector (moved to header)', () => {
    renderWithProviders(<Sidebar />);

    expect(screen.queryByText('Active Strategy')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
