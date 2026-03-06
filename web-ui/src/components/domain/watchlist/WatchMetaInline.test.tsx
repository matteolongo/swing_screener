import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import WatchMetaInline from '@/components/domain/watchlist/WatchMetaInline';

describe('WatchMetaInline', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders positive delta', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-06T12:00:00Z'));

    render(
      <WatchMetaInline
        watchedAt="2026-03-06T11:00:00Z"
        watchPrice={100}
        currentPrice={110}
        currency="USD"
      />,
    );

    expect(screen.getByText('Since watched: +$10.00 (+10.0%)')).toBeInTheDocument();
  });

  it('renders negative delta', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-06T12:00:00Z'));

    render(
      <WatchMetaInline
        watchedAt="2026-03-06T11:00:00Z"
        watchPrice={100}
        currentPrice={90}
        currency="USD"
      />,
    );

    expect(screen.getByText('Since watched: -$10.00 (-10.0%)')).toBeInTheDocument();
  });

  it('renders unavailable delta when prices are missing', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-06T12:00:00Z'));

    render(<WatchMetaInline watchedAt="2026-03-06T11:00:00Z" watchPrice={null} currentPrice={90} currency="USD" />);

    expect(screen.getByText('Since watched: —')).toBeInTheDocument();
  });
});

