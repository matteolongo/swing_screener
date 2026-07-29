import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TrailStatus from './TrailStatus';
import type { TrailData } from './TrailStatus';

describe('TrailStatus', () => {
  const activeTrail: TrailData = {
    method: 'SMA20',
    level: 175.5,
    active: true,
  };

  const trailWithAction: TrailData = {
    method: 'ATR',
    level: 410.0,
    active: true,
    lastActionTimestamp: '2025-01-15 14:30',
    lastActionType: 'adjusted',
  };

  it('renders No active trail when null', () => {
    render(<TrailStatus trail={null} />);
    expect(screen.getByText('No active trail.')).toBeInTheDocument();
  });

  it('renders No active trail when active is false', () => {
    render(<TrailStatus trail={{ ...activeTrail, active: false }} />);
    expect(screen.getByText('No active trail.')).toBeInTheDocument();
  });

  it('renders method badge', () => {
    render(<TrailStatus trail={activeTrail} />);
    expect(screen.getByText('SMA20')).toBeInTheDocument();
  });

  it('renders trail level in mono', () => {
    render(<TrailStatus trail={activeTrail} />);
    expect(screen.getByText('175.50')).toBeInTheDocument();
  });

  it('renders last trailing action', () => {
    render(<TrailStatus trail={trailWithAction} />);
    expect(screen.getByText(/2025-01-15 14:30/)).toBeInTheDocument();
    expect(screen.getByText(/adjusted/)).toBeInTheDocument();
  });

  it('renders method badge for ATR', () => {
    render(<TrailStatus trail={trailWithAction} />);
    expect(screen.getByText('ATR')).toBeInTheDocument();
  });
});
