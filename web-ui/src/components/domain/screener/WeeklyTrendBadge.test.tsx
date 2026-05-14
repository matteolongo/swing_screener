import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import WeeklyTrendBadge from './WeeklyTrendBadge';
import { t } from '@/i18n/t';

describe('WeeklyTrendBadge', () => {
  it('renders up label for trend="up"', () => {
    renderWithProviders(<WeeklyTrendBadge trend="up" />);
    expect(screen.getByText(t('screener.details.weeklyTrend.up'))).toBeInTheDocument();
  });

  it('renders down label for trend="down"', () => {
    renderWithProviders(<WeeklyTrendBadge trend="down" />);
    expect(screen.getByText(t('screener.details.weeklyTrend.down'))).toBeInTheDocument();
  });

  it('renders neutral label for trend="neutral"', () => {
    renderWithProviders(<WeeklyTrendBadge trend="neutral" />);
    expect(screen.getByText(t('screener.details.weeklyTrend.neutral'))).toBeInTheDocument();
  });

  it('renders nothing for trend=null', () => {
    const { container } = renderWithProviders(<WeeklyTrendBadge trend={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for trend=undefined', () => {
    const { container } = renderWithProviders(<WeeklyTrendBadge trend={undefined} />);
    expect(container.firstChild).toBeNull();
  });
});
