import TableShell from '@/components/common/TableShell';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import MetricHelpLabel from '@/components/domain/education/MetricHelpLabel';
import CachedSymbolPriceChart from '@/components/domain/market/CachedSymbolPriceChart';
import DailyReviewWatchInlineBlock, {
  type DailyReviewWatchProps,
} from '@/components/domain/dailyReview/DailyReviewWatchInlineBlock';
import { formatDailyReviewReason } from '@/utils/dailyReviewFormatters';
import type { DailyReviewPositionUpdate } from '@/features/dailyReview/types';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import { t } from '@/i18n/t';

interface DailyReviewUpdateStopTableProps extends DailyReviewWatchProps {
  positions: DailyReviewPositionUpdate[];
  onAction: (position: DailyReviewPositionUpdate) => void;
  isCompactMobileLayout: boolean;
}

export default function DailyReviewUpdateStopTable({
  positions,
  onAction,
  isCompactMobileLayout,
  watchItemsByTicker,
  watchPending,
  onWatch,
  onUnwatch,
}: DailyReviewUpdateStopTableProps) {
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
                title={t('dailyReview.table.update.yahooFinanceTooltip', { ticker: pos.ticker })}
              >
                {pos.ticker}
              </a>
              <DailyReviewWatchInlineBlock
                ticker={pos.ticker}
                currentPrice={pos.currentPrice}
                source="daily_review_update_stop"
                watchItemsByTicker={watchItemsByTicker}
                watchPending={watchPending}
                onWatch={onWatch}
                onUnwatch={onUnwatch}
              />
              <Badge variant="warning">{t('dailyReview.table.update.actionLabel')}</Badge>
            </div>

            <CachedSymbolPriceChart ticker={pos.ticker} className="mt-2" />

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-gray-50 px-2 py-1 dark:bg-gray-700/70">
                <p className="text-gray-500">{t('dailyReview.table.update.headers.entry')}</p>
                <p className="font-semibold">{formatCurrency(pos.entryPrice)}</p>
              </div>
              <div className="rounded-md bg-gray-50 px-2 py-1 dark:bg-gray-700/70">
                <p className="text-gray-500">{t('dailyReview.table.update.headers.current')}</p>
                <p className="font-semibold">{formatCurrency(pos.currentPrice)}</p>
              </div>
              <div className="rounded-md bg-gray-50 px-2 py-1 dark:bg-gray-700/70">
                <p className="text-gray-500">{t('dailyReview.table.update.headers.stopOld')}</p>
                <p>{formatCurrency(pos.stopCurrent)}</p>
              </div>
              <div className="rounded-md bg-gray-50 px-2 py-1 dark:bg-gray-700/70">
                <p className="text-gray-500">{t('dailyReview.table.update.headers.stopNew')}</p>
                <p className="font-semibold text-green-700 dark:text-green-300">
                  {formatCurrency(pos.stopSuggested)}
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs text-gray-600 dark:text-gray-300">{formatDailyReviewReason(pos.reason)}</p>

            <div className="mt-3 flex items-center justify-between gap-3">
              <span
                className={
                  pos.rNow >= 0
                    ? 'text-sm font-semibold text-green-700 dark:text-green-300'
                    : 'text-sm font-semibold text-red-700 dark:text-red-300'
                }
              >
                {t('common.units.rValue', { value: formatNumber(pos.rNow, 2) })}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onAction(pos)}
                title={t('dailyReview.table.update.actionTitle')}
              >
                {t('dailyReview.table.update.actionLabel')}
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <TableShell
      empty={positions.length === 0}
      emptyMessage={t('dailyReview.table.update.empty')}
      tableClassName="text-sm"
      headers={(
        <tr>
          <th className="text-left p-2">{t('dailyReview.table.update.headers.ticker')}</th>
          <th className="text-right p-2">{t('dailyReview.table.update.headers.entry')}</th>
          <th className="text-right p-2">{t('dailyReview.table.update.headers.current')}</th>
          <th className="text-right p-2">{t('dailyReview.table.update.headers.stopOld')}</th>
          <th className="text-right p-2">{t('dailyReview.table.update.headers.stopNew')}</th>
          <th className="text-right p-2">
            <MetricHelpLabel metricKey="R_NOW" className="justify-end w-full" />
          </th>
          <th className="text-left p-2">{t('dailyReview.table.update.headers.reason')}</th>
          <th className="text-right p-2">{t('dailyReview.table.update.headers.action')}</th>
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
              title={t('dailyReview.table.update.yahooFinanceTooltip', { ticker: pos.ticker })}
            >
              {pos.ticker}
            </a>
            <DailyReviewWatchInlineBlock
              ticker={pos.ticker}
              currentPrice={pos.currentPrice}
              source="daily_review_update_stop"
              watchItemsByTicker={watchItemsByTicker}
              watchPending={watchPending}
              onWatch={onWatch}
              onUnwatch={onUnwatch}
            />
            <CachedSymbolPriceChart ticker={pos.ticker} className="mt-1" />
          </td>
          <td className="p-2 text-right">{formatCurrency(pos.entryPrice)}</td>
          <td className="p-2 text-right">{formatCurrency(pos.currentPrice)}</td>
          <td className="p-2 text-right text-gray-600 dark:text-gray-400">{formatCurrency(pos.stopCurrent)}</td>
          <td className="p-2 text-right font-bold text-green-700 dark:text-green-300">
            {formatCurrency(pos.stopSuggested)}
          </td>
          <td className="p-2 text-right">
            <span className={pos.rNow >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
              {t('common.units.rValue', { value: formatNumber(pos.rNow, 2) })}
            </span>
          </td>
          <td className="p-2 text-sm">{formatDailyReviewReason(pos.reason)}</td>
          <td className="p-2 text-right">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onAction(pos)}
              title={t('dailyReview.table.update.actionTitle')}
            >
              {t('dailyReview.table.update.actionLabel')}
            </Button>
          </td>
        </tr>
      ))}
    </TableShell>
  );
}
