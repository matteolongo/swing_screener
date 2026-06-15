import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FundamentalsStrip from './FundamentalsStrip';
import { t } from '@/i18n/t';

describe('FundamentalsStrip', () => {
  it('renders P/E, revenue growth, gross margin, valuation', () => {
    render(
      <FundamentalsStrip
        trailingPe={22.5}
        revenueGrowthYoy={0.18}
        grossMargin={0.46}
        valuationLabel="fair"
      />,
    );
    expect(screen.getByText(t('workspacePage.panels.analysis.fundamentalsStrip.pe'))).toBeInTheDocument();
    expect(screen.getByText('22.5')).toBeInTheDocument();
    expect(screen.getByText('18.0%')).toBeInTheDocument();
    expect(screen.getByText('46.0%')).toBeInTheDocument();
  });

  it('renders an unavailable note when nothing is loaded', () => {
    render(<FundamentalsStrip />);
    expect(
      screen.getByText(t('workspacePage.panels.analysis.fundamentalsStrip.unavailable')),
    ).toBeInTheDocument();
  });
});
