import { useMemo } from 'react';
import CollapsibleCard from '@/components/common/CollapsibleCard';
import RChip from '@/components/common/RChip';
import Badge from '@/components/common/Badge';
import { TimeStopBadge, ExhaustionBadge, EarningsBadge } from './rowBadges';
import { usePositions } from '@/features/portfolio/hooks';
import { useDailyReview } from '@/features/dailyReview/api';
import { readScreenerSelection } from '@/features/screener/selectionStorage';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import { formatPercent, getSignColorClass } from '@/utils/formatters';
import type { TrimSuggestion } from '@/features/dailyReview/types';

export interface PositionsMiniCardProps {
  onTickerSelect: (ticker: string) => void;
}

interface ExhaustionInfo {
  score: number | null;
  label: string | null;
  trimSuggestion?: TrimSuggestion | null;
}

export default function PositionsMiniCard({ onTickerSelect }: PositionsMiniCardProps) {
  const { data: positions } = usePositions('open');
  const { data: review } = useDailyReview(200, readScreenerSelection());

  const exhaustionByTicker = useMemo(() => {
    const map = new Map<string, ExhaustionInfo>();
    for (const update of review?.positionsUpdateStop ?? []) {
      map.set(update.ticker, { score: update.exhaustionScore, label: update.exhaustionLabel });
    }
    for (const hold of review?.positionsHold ?? []) {
      map.set(hold.ticker, {
        score: hold.exhaustionScore,
        label: hold.exhaustionLabel,
        trimSuggestion: hold.trimSuggestion,
      });
    }
    return map;
  }, [review]);

  const rows = positions ?? [];

  return (
    <CollapsibleCard
      id="today.positions"
      title={t('todayPage.positionsCard.title')}
      summary={<span className="text-xs text-muted">{rows.length}</span>}
    >
      {rows.length === 0 ? (
        <p className="text-xs text-muted">{t('todayPage.positionsCard.empty')}</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((position) => {
            const exhaustion = exhaustionByTicker.get(position.ticker);
            return (
              <div key={position.positionId ?? position.ticker} className="flex items-center gap-2 text-[13px]">
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => onTickerSelect(position.ticker)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onTickerSelect(position.ticker);
                  }}
                  className="shrink-0 font-semibold text-foreground hover:underline cursor-pointer"
                >
                  {position.ticker}
                </span>
                <RChip value={position.rNow} className="shrink-0" />
                <span className="shrink-0 text-xs text-muted">{position.daysOpen}d</span>
                <TimeStopBadge daysOpen={position.daysOpen} rNow={position.rNow} show={position.timeStopWarning} />
                <ExhaustionBadge score={exhaustion?.score ?? null} label={exhaustion?.label ?? null} />
                <EarningsBadge ticker={position.ticker} />
                {exhaustion?.trimSuggestion && (
                  <Badge variant="warning" className="shrink-0">
                    {t('todayPage.positionsCard.trim')}
                  </Badge>
                )}
                <span
                  className={cn('ml-auto shrink-0 font-mono text-xs', getSignColorClass(position.pnlPercent))}
                >
                  {formatPercent(position.pnlPercent)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </CollapsibleCard>
  );
}
