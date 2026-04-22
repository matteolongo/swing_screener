import { useSymbolHistory } from '@/features/portfolio/hooks';
import { useScreenerRecurrence } from '@/features/screener/recurrenceHooks';
import type { Position } from '@/types/position';
import { t } from '@/i18n/t';
import { formatNumber } from '@/utils/formatters';
import { cn } from '@/utils/cn';

interface SymbolTradeHistoryProps {
  ticker: string;
}

function computeR(position: Position): number | null {
  if (
    position.exitPrice == null ||
    position.entryPrice == null ||
    position.stopPrice == null
  ) {
    return null;
  }
  const perShareRisk = position.entryPrice - position.stopPrice;
  if (perShareRisk === 0) return null;
  return (position.exitPrice - position.entryPrice) / perShareRisk;
}

function ROutcomeBadge({ r }: { r: number | null }) {
  if (r == null) {
    return <span className="text-gray-400">{t('common.placeholders.dash')}</span>;
  }
  const sign = r >= 0 ? '+' : '';
  const formatted = `${sign}${formatNumber(r, 1)}R`;
  return (
    <span className={cn('font-mono font-semibold', r >= 0 ? 'text-green-600' : 'text-red-500')}>
      {formatted}
    </span>
  );
}

export default function SymbolTradeHistory({ ticker }: SymbolTradeHistoryProps) {
  const { data, isLoading } = useSymbolHistory(ticker);
  const recurrenceQuery = useScreenerRecurrence();

  if (isLoading) {
    return (
      <div className="text-sm text-gray-500 py-4 text-center">
        {t('symbolTradeHistory.loading')}
      </div>
    );
  }

  const positions = data?.positions ?? [];
  const openPositions = positions.filter((p) => p.status === 'open');
  const closedPositions = positions.filter((p) => p.status === 'closed');
  const totalCount = positions.length;

  if (totalCount === 0) {
    return (
      <div className="text-sm text-gray-500 py-4 text-center">
        {t('symbolTradeHistory.noPastTrades', { ticker })}
      </div>
    );
  }

  const tradeLabel =
    totalCount === 1
      ? t('symbolTradeHistory.tradeSingular')
      : t('symbolTradeHistory.tradePlural', { n: totalCount });

  // Compute summary stats from closed positions
  let summaryLine: string | null = null;
  if (closedPositions.length >= 2) {
    const rValues = closedPositions.map(computeR).filter((r): r is number => r != null);
    const wins = rValues.filter((r) => r >= 0).length;
    const winRate = rValues.length > 0 ? Math.round((wins / rValues.length) * 100) : 0;
    const avgR =
      rValues.length > 0
        ? formatNumber(rValues.reduce((a, b) => a + b, 0) / rValues.length, 1)
        : t('common.placeholders.dash');
    summaryLine = t('symbolTradeHistory.summary', {
      n: closedPositions.length,
      winRate,
      avgR,
    });
  }

  // Recurrence for this ticker
  const tickerRecurrence = recurrenceQuery.data?.find(
    (r) => r.ticker.toUpperCase() === ticker.toUpperCase()
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gray-900 dark:text-gray-100">{ticker}</span>
        <span className="text-xs text-gray-500">{tradeLabel}</span>
      </div>

      {/* Summary */}
      {summaryLine && (
        <div className="text-xs text-gray-500">{summaryLine}</div>
      )}

      {/* Recurrence */}
      {tickerRecurrence && (
        <div className="text-xs text-gray-500 flex flex-wrap gap-3">
          <span>{t('symbolTradeHistory.screenerSeenCount', { n: tickerRecurrence.daysSeen })}</span>
          {tickerRecurrence.streak > 0 && (
            <span>{t('symbolTradeHistory.screenerStreak', { n: tickerRecurrence.streak })}</span>
          )}
          <span>{t('symbolTradeHistory.screenerLastSeen', { date: tickerRecurrence.lastSeen })}</span>
        </div>
      )}

      {/* Open positions */}
      {openPositions.length > 0 && (
        <div className="flex flex-col gap-2">
          {openPositions.map((pos, i) => (
            <div
              key={pos.positionId ?? i}
              className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-2 text-sm"
            >
              <div className="font-medium text-amber-800 dark:text-amber-200 mb-1">
                {t('symbolTradeHistory.openPosition')}
              </div>
              <div className="flex gap-4 text-xs text-gray-600 dark:text-gray-400">
                <span>
                  {t('symbolTradeHistory.entryLabel')}: {formatNumber(pos.entryPrice, 2)}
                </span>
                <span>
                  {t('symbolTradeHistory.stopLabel')}: {formatNumber(pos.stopPrice, 2)}
                </span>
                <span>
                  {t('symbolTradeHistory.sharesLabel')}: {pos.shares}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Closed trades table */}
      {closedPositions.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <tbody>
              {closedPositions.map((pos, i) => {
                const r = computeR(pos);
                return (
                  <tr
                    key={pos.positionId ?? i}
                    className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                  >
                    <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">
                      {pos.entryDate}
                      {pos.exitDate ? ` → ${pos.exitDate}` : ''}
                    </td>
                    <td className="py-1.5 pr-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {formatNumber(pos.entryPrice, 2)}
                      {pos.exitPrice != null ? ` → ${formatNumber(pos.exitPrice, 2)}` : ''}
                    </td>
                    <td className="py-1.5 text-right">
                      <ROutcomeBadge r={r} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
