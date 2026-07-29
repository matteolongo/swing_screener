import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ModeToggle from './ModeToggle';
import { useAppStore } from '../../store/useAppStore';

beforeEach(() => {
  useAppStore.setState({
    mode: 'eod',
    activeTab: 'screener',
    alerts: [],
    accountSize: 50000,
    drawerOpen: false,
    bannerDismissed: false,
  });
});

describe('ModeToggle', () => {
  it('renders both mode buttons', () => {
    render(<ModeToggle />);
    expect(screen.getByText('EOD')).toBeInTheDocument();
    expect(screen.getByText('Intraday')).toBeInTheDocument();
  });

  it('highlights EOD by default', () => {
    render(<ModeToggle />);
    const eodBtn = screen.getByText('EOD');
    expect(eodBtn.className).toContain('bg-accent');
  });

  it('switches to intraday on click', () => {
    render(<ModeToggle />);
    fireEvent.click(screen.getByText('Intraday'));
    expect(useAppStore.getState().mode).toBe('intraday');
  });

  it('switches back to EOD on click', () => {
    useAppStore.setState({ mode: 'intraday' });
    render(<ModeToggle />);
    fireEvent.click(screen.getByText('EOD'));
    expect(useAppStore.getState().mode).toBe('eod');
  });
});
