import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SortControls from './SortControls';
import { useScreenerStore } from '../../store/useScreenerStore';

beforeEach(() => {
  useScreenerStore.setState({
    sortBy: 'score',
    candidates: [],
    universe: 'us_sp500',
    preset: null,
    isLoading: false,
    error: null,
  });
});

describe('SortControls', () => {
  it('renders three sort buttons', () => {
    render(<SortControls />);
    expect(screen.getByText('Score')).toBeInTheDocument();
    expect(screen.getByText('R:R')).toBeInTheDocument();
    expect(screen.getByText('Price')).toBeInTheDocument();
  });

  it('highlights active sort by', () => {
    useScreenerStore.getState().setSortBy('rr');
    render(<SortControls />);
    const rrBtn = screen.getByText('R:R');
    expect(rrBtn.className).toContain('border-accent');
  });

  it('dispatches setSortBy on click', () => {
    render(<SortControls />);
    fireEvent.click(screen.getByText('Price'));
    expect(useScreenerStore.getState().sortBy).toBe('price');
  });
});
