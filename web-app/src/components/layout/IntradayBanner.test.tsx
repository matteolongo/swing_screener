import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import IntradayBanner from './IntradayBanner';
import { useAppStore } from '../../store/useAppStore';

beforeEach(() => {
  useAppStore.setState({
    mode: 'eod',
    bannerDismissed: false,
    activeTab: 'screener',
    alerts: [],
    accountSize: 50000,
    drawerOpen: false,
  });
});

describe('IntradayBanner', () => {
  it('does not render when mode is eod', () => {
    render(<IntradayBanner />);
    expect(screen.queryByText('Intraday preview')).not.toBeInTheDocument();
  });

  it('renders when mode is intraday', () => {
    useAppStore.setState({ mode: 'intraday' });
    render(<IntradayBanner />);
    expect(screen.getByText(/Intraday preview/)).toBeInTheDocument();
    expect(screen.getByText(/read-only/)).toBeInTheDocument();
  });

  it('does not render when dismissed', () => {
    useAppStore.setState({ mode: 'intraday', bannerDismissed: true });
    render(<IntradayBanner />);
    expect(screen.queryByText('Intraday preview')).not.toBeInTheDocument();
  });

  it('dismisses on X button click', () => {
    useAppStore.setState({ mode: 'intraday', bannerDismissed: false });
    render(<IntradayBanner />);
    fireEvent.click(screen.getByLabelText('Dismiss intraday banner'));
    expect(useAppStore.getState().bannerDismissed).toBe(true);
  });
});
