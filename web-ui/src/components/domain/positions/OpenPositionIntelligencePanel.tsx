import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import { formatNumber, getSignColorClass } from '@/utils/formatters';
import {
  useOpenPositionsIntelligence,
  useAnalyzePositionMutation,
} from '@/features/portfolio/hooks';

interface Props {
  onTickerSelect: (ticker: string) => void;
}

function stopActionLabel(action: string): string {
  const map: Record<string, string> = {
    NO_ACTION: t('todayPage.openPositions.stopAction.NO_ACTION'),
    MOVE_STOP_UP: t('todayPage.openPositions.stopAction.MOVE_STOP_UP'),
    CLOSE_STOP_HIT: t('todayPage.openPositions.stopAction.CLOSE_STOP_HIT'),
    CLOSE_TIME_EXIT: t('todayPage.openPositions.stopAction.CLOSE_TIME_EXIT'),
    CLOSE_EXIT_SIGNAL: t('todayPage.openPositions.stopAction.CLOSE_EXIT_SIGNAL'),
  };
  return map[action] ?? action;
}

function positionSignalLabel(action: string): string {
  const map: Record<string, string> = {
    HOLD: t('todayPage.openPositions.positionSignal.HOLD'),
    TRIM: t('todayPage.openPositions.positionSignal.TRIM'),
    EXIT: t('todayPage.openPositions.positionSignal.EXIT'),
  };
  return map[action] ?? action;
}

function stopActionColor(action: string): string {
  if (action === 'MOVE_STOP_UP') return 'bg-warning/10 text-warning';
  if (action.startsWith('CLOSE_')) return 'bg-danger/10 text-danger';
  return 'bg-foreground/5 text-muted';
}

function positionSignalColor(action: string): string {
  if (action === 'EXIT') return 'bg-danger/10 text-danger';
  if (action === 'TRIM') return 'bg-warning/10 text-warning';
  return 'bg-success/10 text-success';
}

export default function OpenPositionIntelligencePanel({ onTickerSelect }: Props) {
  const { data: summaries } = useOpenPositionsIntelligence();
  const analyzeMutation = useAnalyzePositionMutation();

  if (!summaries || summaries.length === 0) return null;

  return (
    <div className="mb-3 space-y-1">
      <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary bg-primary/10 rounded">
        {t('todayPage.openPositions.sectionTitle')} · {summaries.length}
      </div>
      {summaries.map((item) => {
        const isAnalyzing =
          analyzeMutation.isPending && analyzeMutation.variables === item.positionId;
        const posSignal = item.intelligence?.positionSignal;

        return (
          <button
            key={item.positionId}
            type="button"
            onClick={() => onTickerSelect(item.ticker)}
            className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-foreground/5 transition-colors border-l-2 border-primary/40"
          >
            <span className="text-sm font-semibold text-foreground min-w-[60px] shrink-0">
              {item.ticker}
            </span>

            <span
              className={cn(
                'text-xs font-semibold tabular-nums shrink-0',
                getSignColorClass(item.rNow),
              )}
            >
              {item.rNow >= 0 ? '+' : ''}{formatNumber(item.rNow, 2)}R
            </span>

            <span
              className={cn(
                'text-xs font-medium px-1.5 py-0.5 rounded shrink-0',
                stopActionColor(item.stopAction),
              )}
            >
              {stopActionLabel(item.stopAction)}
            </span>

            {posSignal ? (
              <>
                <span
                  className={cn(
                    'text-xs font-medium px-1.5 py-0.5 rounded shrink-0',
                    positionSignalColor(posSignal.action),
                  )}
                >
                  {positionSignalLabel(posSignal.action)}
                </span>
                <span className="text-xs text-muted truncate flex-1 min-w-0">
                  {item.intelligence?.summaryLine}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted flex-1 min-w-0">
                {t('todayPage.openPositions.noIntelligence')}
              </span>
            )}

            <span
              role="button"
              tabIndex={0}
              aria-label={t('todayPage.openPositions.analyzeButton')}
              onClick={(e) => {
                e.stopPropagation();
                analyzeMutation.mutate(item.positionId);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  analyzeMutation.mutate(item.positionId);
                }
              }}
              className="shrink-0 text-xs px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"
            >
              {isAnalyzing ? (
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
              ) : (
                t('todayPage.openPositions.analyzeButton')
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
