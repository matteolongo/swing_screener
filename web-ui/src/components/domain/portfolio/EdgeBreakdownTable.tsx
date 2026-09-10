import type { PortfolioAnalytics } from '@/features/portfolio/api';
import { t } from '@/i18n/t';
import StatsTable, { type StatsTableHeaders } from './StatsTable';

function tagLabel(tag: string): string {
  const labels: Record<string, string> = {
    breakout: t('tradeTags.breakout'),
    pullback: t('tradeTags.pullback'),
    add_on: t('tradeTags.addOn'),
    stop_hit: t('tradeTags.stopHit'),
    target_reached: t('tradeTags.targetReached'),
    time_stop: t('tradeTags.timeStop'),
    manual_exit: t('tradeTags.manualExit'),
    trending: t('tradeTags.trending'),
    choppy: t('tradeTags.choppy'),
    news_driven: t('tradeTags.newsDriven'),
  };
  return labels[tag] ?? tag;
}

interface EdgeBreakdownTableProps {
  rows: PortfolioAnalytics['tagBreakdown'];
}

export default function EdgeBreakdownTable({ rows: stats }: EdgeBreakdownTableProps) {
  if (stats.length === 0) {
    return (
      <p className="py-4 text-sm text-muted">
        {t('analyticsPage.edgeBreakdown.emptyState')}
      </p>
    );
  }

  const headers: StatsTableHeaders = {
    label: t('analyticsPage.edgeBreakdown.colTag'),
    trades: t('analyticsPage.edgeBreakdown.colTrades'),
    winRate: t('analyticsPage.edgeBreakdown.colWinRate'),
    avgR: t('analyticsPage.edgeBreakdown.colAvgR'),
    expectancy: t('analyticsPage.edgeBreakdown.colExpectancy'),
    expectancyHint: t('analyticsPage.edgeBreakdown.expectancyHint'),
  };

  const rows = stats.map((stat) => ({
    key: stat.tag,
    label: tagLabel(stat.tag),
    count: stat.tradeCount,
    winRate: stat.winRate ?? 0,
    avgR: stat.averageR,
    expectancy: stat.expectancy,
  }));

  return <StatsTable headers={headers} rows={rows} />;
}
