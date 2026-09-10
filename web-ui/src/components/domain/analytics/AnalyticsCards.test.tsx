import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import { EdgeInsightCard } from './AnalyticsCards';

describe('EdgeInsightCard', () => {
  it('renders the backend verdict instead of recreating an insight policy', () => {
    renderWithProviders(
      <EdgeInsightCard {...{
        insight: { verdict: 'negative', reason: 'negative_average_r' },
        totalTrades: 20,
        avgR: 1.5,
        profitFactor: 2,
        winRate: 70,
      } as any} />,
    );

    expect(screen.getByText(t('analyticsPage.insight.verdictLabel.negative'))).toBeInTheDocument();
  });
});
