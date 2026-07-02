import Badge from '@/components/common/Badge';
import { t } from '@/i18n/t';
import { formatNumber } from '@/utils/formatters';
import { useEarningsProximity } from '@/features/portfolio/hooks';
import { exhaustionBadge, positionSignalBadge } from '@/lib/badgeMap';
import type { OpenPositionIntelligenceSummary } from '@/features/intelligence/types';

export interface TimeStopBadgeProps {
  daysOpen: number;
  rNow: number;
  show: boolean;
}

export function TimeStopBadge({ daysOpen, rNow, show }: TimeStopBadgeProps) {
  if (!show) return null;
  return (
    <span
      className="text-xs font-medium px-1.5 py-0.5 rounded bg-warning/10 text-warning"
      title={t('todayPage.actionList.timeStopWarning')}
    >
      {t('todayPage.actionList.timeStopBadge', {
        days: String(daysOpen),
        r: `${rNow >= 0 ? '+' : ''}${formatNumber(rNow, 2)}`,
      })}
    </span>
  );
}

export function EarningsBadge({ ticker }: { ticker: string }) {
  const { data } = useEarningsProximity(ticker);
  if (!data?.warning || data.daysUntil == null) return null;
  return (
    <span
      className="text-xs font-medium px-1.5 py-0.5 rounded bg-warning/10 text-warning shrink-0"
      title={`Earnings in ${data.daysUntil} day${data.daysUntil === 1 ? '' : 's'}`}
    >
      {t('todayPage.actionList.earningsBadge', { days: String(data.daysUntil) })}
    </span>
  );
}

export function ExhaustionBadge({ score, label }: { score: number | null; label: string | null }) {
  if (score == null || (label !== 'fine' && label !== 'watch' && label !== 'exit')) return null;
  const spec = exhaustionBadge(label);
  return (
    <span title={`Exhaustion: ${score.toFixed(1)}/10`} className="shrink-0">
      <Badge variant={spec.variant}>
        {t(spec.labelKey)} {score.toFixed(1)}
      </Badge>
    </span>
  );
}

export function AiSignalBadge({ summary }: { summary: OpenPositionIntelligenceSummary | undefined }) {
  const posSignal = summary?.intelligence?.positionSignal;
  if (!posSignal) return null;
  const spec = positionSignalBadge(posSignal.action);
  return (
    <Badge variant={spec.variant} className="shrink-0">
      {t(spec.labelKey)}
    </Badge>
  );
}

export function VolumeDot({ ratio }: { ratio: number | undefined }) {
  if (ratio == null) return null;
  if (ratio >= 1.5) {
    return (
      <span
        className="inline-block w-2 h-2 rounded-full bg-success shrink-0"
        title={`Volume ${ratio.toFixed(1)}× avg (strong)`}
      />
    );
  }
  if (ratio < 0.8) {
    return (
      <span
        className="inline-block w-2 h-2 rounded-full bg-foreground/10 shrink-0"
        title={`Volume ${ratio.toFixed(1)}× avg (weak)`}
      />
    );
  }
  return null;
}
