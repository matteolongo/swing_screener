import TableShell from '@/components/common/TableShell';
import Badge from '@/components/common/Badge';
import MetricHelpLabel from '@/components/domain/education/MetricHelpLabel';
import CachedSymbolPriceChart from '@/components/domain/market/CachedSymbolPriceChart';
import DailyReviewWatchInlineBlock, {
  type DailyReviewWatchProps,
} from '@/components/domain/dailyReview/DailyReviewWatchInlineBlock';
import { formatDailyReviewReason } from '@/utils/dailyReviewFormatters';
import type { DailyReviewPositionHold } from '@/features/dailyReview/types';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import { t } from '@/i18n/t';

interface DailyReviewHoldTableProps extends DailyReviewWatchProps {
  positions: DailyReviewPositionHold[];
  isCompactMobileLayout: boolean;
}

export default function DailyReviewHoldTable({
  positions,
  isCompactMobileLayout,
  watchItemsByTicker,
  watchPending,
  onWatch,
  onUnwatch,
}: DailyReviewHoldTableProps) {
  if (isCompactMobileLayout) {
    return (
      <div className="space-y-3">
        {positions.map((pos) => (
          <div
            key={pos.positionId}
            className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="flex items-start justify-between gap-3">
              <a
                href={`https://finance.yahoo.com/quote/${pos.ticker}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-base font-bold text-blue-700 hover:underline"
                title={t('dailyReview.table.hold.yahooFinanceTooltip', { ticker: pos.ticker })}
              >
                {pos.ticker}
              </a>
              <DailyReviewWatchInlineBlock
                ticker={pos.ticker}
                currentPrice={pos.currentPrice}
                source="daily_review_hold"
                watchItemsByTicker={watchItemsByTicker}
                watchPending={watchPending}
                onWatch={onWatch}
                onUnwatch={onUnwatch}
              />
              <Badge variant="success">{t('dailyReview.table.hold.holdBadge')}</Badge>
            </div>

            <CachedSymbolPriceChart ticker={pos.ticker} className="mt-2" />

            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-md bg-gray-50 px-2 py-1 dark:bg-gray-700/70">
                <p className="text-gray-500">{t('dailyReview.table.hold.headers.entry')}</p>
                <p className="font-semibold">{formatCurrency(pos.entryPrice)}</p>
              </div>
              <div className="rounded-md bg-gray-50 px-2 py-1 dark:bg-gray-700/70">
                <p className="text-gray-500">{t('dailyReview.table.hold.headers.current')}</p>
                <p className="font-semibold">{formatCurrency(pos.currentPrice)}</p>
              </div>
              <div className="rounded-md bg-gray-50 px-2 py-1 dark:bg-gray-700/70">
                <p className="text-gray-500">{t('dailyReview.table.hold.headers.stop')}</p>
                <p>{formatCurrency(pos.stopPrice)}</p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-600 dark:text-gray-300">{formatDailyReviewReason(pos.reason)}</p>
              <span
                className={
                  pos.rNow >= 0
                    ? 'text-sm font-semibold text-green-700 dark:text-green-300'
                    : 'text-sm font-semibold text-red-700 dark:text-red-300'
                }
              >
                {t('common.units.rValue', { value: formatNumber(pos.rNow, 2) })}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <TableShell
      empty={positions.length === 0}
      emptyMessage={t('dailyReview.table.hold.empty')}
      tableClassName="text-sm"
      headers={(
        <tr>
          <th className="text-left p-2">{t('dailyReview.table.hold.headers.ticker')}</th>
          <th className="text-right p-2">{t('dailyReview.table.hold.headers.entry')}</th>
          <th className="text-right p-2">{t('dailyReview.table.hold.headers.current')}</th>
          <th className="text-right p-2">{t('dailyReview.table.hold.headers.stop')}</th>
          <th className="text-right p-2">
            <MetricHelpLabel metricKey="R_NOW" className="justify-end w-full" />
          </th>
          <th className="text-left p-2">{t('dailyReview.table.hold.headers.reason')}</th>
        </tr>
      )}
    >
      {positions.map((pos) => (
        <tr key={pos.positionId} className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
          <td className="p-2 font-mono font-bold">
            <a
              href={`https://finance.yahoo.com/quote/${pos.ticker}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline"
              title={t('dailyReview.table.hold.yahooFinanceTooltip', { ticker: pos.ticker })}
            >
              {pos.ticker}
            </a>
            <DailyReviewWatchInlineBlock
              ticker={pos.ticker}
              currentPrice={pos.currentPrice}
              source="daily_review_hold"
              watchItemsByTicker={watchItemsByTicker}
              watchPending={watchPending}
              onWatch={onWatch}
              onUnwatch={onUnwatch}
            />
            <CachedSymbolPriceChart ticker={pos.ticker} className="mt-1" />
          </td>
          <td className="p-2 text-right">{formatCurrency(pos.entryPrice)}</td>
          <td className="p-2 text-right">{formatCurrency(pos.currentPrice)}</td>
          <td className="p-2 text-right">{formatCurrency(pos.stopPrice)}</td>
          <td className="p-2 text-right">
            <span className={pos.rNow >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
              {t('common.units.rValue', { value: formatNumber(pos.rNow, 2) })}
            </span>
          </td>
          <td className="p-2 text-sm text-gray-600 dark:text-gray-400">{formatDailyReviewReason(pos.reason)}</td>
        </tr>
      ))}
    </TableShell>
  );
}
