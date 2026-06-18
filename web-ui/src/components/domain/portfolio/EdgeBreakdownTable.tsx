import { useMemo } from 'react';
import type { Position } from '@/types/position';
import { t } from '@/i18n/t';
import StatsTable, { type StatsTableHeaders } from './StatsTable';

interface TagStats {
  tag: string;
  count: number;
  winRate: number;
  avgR: number;
  expectancy: number;
}

const MIN_TRADES_FOR_DISPLAY = 5;

function finalR(position: Position): number | null {
  if (!position.initialRisk || position.initialRisk <= 0 || position.exitPrice == null) return null;
  return (position.exitPrice - position.entryPrice) * position.shares / position.initialRisk;
}

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

function computeTagStats(positions: Position[]): TagStats[] {
  const byTag = new Map<string, Position[]>();
  for (const position of positions) {
    for (const tag of position.tags ?? []) {
      const tagged = byTag.get(tag) ?? [];
      tagged.push(position);
      byTag.set(tag, tagged);
    }
  }

  const stats: TagStats[] = [];
  for (const [tag, taggedPositions] of byTag.entries()) {
    const rValues = taggedPositions.map(finalR).filter((r): r is number => r !== null);
    if (rValues.length === 0) continue;

    const wins = rValues.filter((r) => r > 0);
    const losses = rValues.filter((r) => r <= 0);
    const winRate = (wins.length / rValues.length) * 100;
    const avgWinR = wins.length > 0 ? wins.reduce((sum, r) => sum + r, 0) / wins.length : 0;
    const avgLossR = losses.length > 0 ? Math.abs(losses.reduce((sum, r) => sum + r, 0) / losses.length) : 0;

    stats.push({
      tag,
      count: rValues.length,
      winRate,
      avgR: rValues.reduce((sum, r) => sum + r, 0) / rValues.length,
      expectancy: avgWinR * (winRate / 100) - avgLossR * (1 - winRate / 100),
    });
  }

  return stats.sort((a, b) => b.expectancy - a.expectancy);
}

interface EdgeBreakdownTableProps {
  positions: Position[];
}

export default function EdgeBreakdownTable({ positions }: EdgeBreakdownTableProps) {
  const taggedClosed = useMemo(
    () => positions.filter((position) => position.status === 'closed' && (position.tags ?? []).length > 0),
    [positions],
  );
  const stats = useMemo(() => computeTagStats(taggedClosed), [taggedClosed]);

  if (taggedClosed.length < MIN_TRADES_FOR_DISPLAY) {
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
    count: stat.count,
    winRate: stat.winRate,
    avgR: stat.avgR,
    expectancy: stat.expectancy,
  }));

  return <StatsTable headers={headers} rows={rows} />;
}
