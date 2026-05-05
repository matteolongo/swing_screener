import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import EdgeBreakdownTable from './EdgeBreakdownTable';
import type { Position } from '@/types/position';
import { t } from '@/i18n/t';

function makePosition(overrides: Partial<Position>): Position {
  return {
    ticker: 'TEST',
    status: 'closed',
    entryDate: '2026-01-01',
    entryPrice: 100,
    stopPrice: 95,
    shares: 10,
    initialRisk: 50,
    exitPrice: 110,
    exitDate: '2026-01-15',
    notes: '',
    tags: [],
    ...overrides,
  };
}

describe('EdgeBreakdownTable', () => {
  it('shows empty state when fewer than 5 tagged trades', () => {
    const positions = [
      makePosition({ tags: ['breakout'], exitPrice: 110 }),
      makePosition({ tags: ['breakout'], exitPrice: 90 }),
    ];

    renderWithProviders(<EdgeBreakdownTable positions={positions} />);

    expect(screen.getByText(t('analyticsPage.edgeBreakdown.emptyState'))).toBeInTheDocument();
  });

  it('shows breakdown when 5+ tagged trades exist', () => {
    const positions = Array.from({ length: 6 }, (_, i) =>
      makePosition({ tags: ['breakout'], exitPrice: i % 2 === 0 ? 110 : 90 }),
    );

    renderWithProviders(<EdgeBreakdownTable positions={positions} />);

    expect(screen.getByText(t('tradeTags.breakout'))).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('computes win rate correctly', () => {
    const positions = [
      makePosition({ tags: ['breakout'], exitPrice: 110, entryPrice: 100, initialRisk: 10 }),
      makePosition({ tags: ['breakout'], exitPrice: 110, entryPrice: 100, initialRisk: 10 }),
      makePosition({ tags: ['breakout'], exitPrice: 110, entryPrice: 100, initialRisk: 10 }),
      makePosition({ tags: ['breakout'], exitPrice: 90, entryPrice: 100, initialRisk: 10 }),
      makePosition({ tags: ['breakout'], exitPrice: 110, entryPrice: 100, initialRisk: 10 }),
    ];

    renderWithProviders(<EdgeBreakdownTable positions={positions} />);

    expect(screen.getByText('80%')).toBeInTheDocument();
  });
});
