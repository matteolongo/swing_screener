import { Info } from 'lucide-react';
import TableShell from '@/components/common/TableShell';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import MetricHelpLabel from '@/components/domain/education/MetricHelpLabel';
import CachedSymbolPriceChart from '@/components/domain/market/CachedSymbolPriceChart';
import DailyReviewWatchInlineBlock, {
  type DailyReviewWatchProps,
} from '@/components/domain/dailyReview/DailyReviewWatchInlineBlock';
import type { DailyReviewCandidate } from '@/features/dailyReview/types';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import { t } from '@/i18n/t';

interface DailyReviewCandidatesTableProps extends DailyReviewWatchProps {
  candidates: DailyReviewCandidate[];
  onShowRecommendation: (candidate: DailyReviewCandidate) => void;
  onCreateOrder: (candidate: DailyReviewCandidate) => void;
  isCompactMobileLayout: boolean;
}

export default function DailyReviewCandidatesTable({
  candidates,
  onShowRecommendation,
  onCreateOrder,
  isCompactMobileLayout,
  watchItemsByTicker,
  watchPending,
  onWatch,
  onUnwatch,
}: DailyReviewCandidatesTableProps) {
  if (isCompactMobileLayout) {
    return (
      <div className="space-y-3">
        {candidates.map((candidate) => (
          <div
            key={candidate.ticker}
            className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <a
                  href={`https://finance.yahoo.com/quote/${candidate.ticker}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-base font-bold text-blue-700 hover:underline"
                  title={t('dailyReview.table.candidates.yahooFinanceTooltip', { ticker: candidate.ticker })}
                >
                  {candidate.ticker}
                </a>
                <p className="mt-0.5 text-xs text-gray-500">
                  {candidate.sector || t('common.placeholders.dash')}
                </p>
                <DailyReviewWatchInlineBlock
                  ticker={candidate.ticker}
                  currentPrice={candidate.close}
                  source="daily_review_candidates"
                  watchItemsByTicker={watchItemsByTicker}
                  watchPending={watchPending}
                  onWatch={onWatch}
                  onUnwatch={onUnwatch}
                />
              </div>
              <Badge variant="primary">{candidate.signal}</Badge>
            </div>

            <CachedSymbolPriceChart ticker={candidate.ticker} className="mt-2" />

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-gray-50 px-2 py-1 dark:bg-gray-700/70">
                <p className="text-gray-500">{t('dailyReview.table.candidates.headers.entry')}</p>
                <p className="font-semibold">{formatCurrency(candidate.entry)}</p>
              </div>
              <div className="rounded-md bg-gray-50 px-2 py-1 dark:bg-gray-700/70">
                <p className="text-gray-500">{t('dailyReview.table.candidates.headers.stop')}</p>
                <p className="font-semibold">{formatCurrency(candidate.stop)}</p>
              </div>
              <div className="rounded-md bg-gray-50 px-2 py-1 dark:bg-gray-700/70">
                <p className="text-gray-500">{t('dailyReview.table.candidates.headers.shares')}</p>
                <p className="font-semibold">{candidate.shares}</p>
              </div>
              <div className="rounded-md bg-gray-50 px-2 py-1 dark:bg-gray-700/70">
                <p className="text-gray-500">{t('dailyReview.table.candidates.headers.riskReward')}</p>
                <p className="font-semibold">
                  {t('common.units.rValue', { value: formatNumber(candidate.rReward, 1) })}
                </p>
              </div>
              <div className="col-span-2 rounded-md bg-gray-50 px-2 py-1 dark:bg-gray-700/70">
                <p className="text-gray-500">{t('dailyReview.table.candidates.headers.confidence')}</p>
                <p className="font-semibold text-purple-700 dark:text-purple-300">
                  {candidate.confidence != null ? formatNumber(candidate.confidence, 1) : '-'}
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              {candidate.recommendation ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={() => onShowRecommendation(candidate)}
                  title={t('dailyReview.table.candidates.recommendationTitle')}
                  aria-label={t('dailyReview.table.candidates.recommendationAria', { ticker: candidate.ticker })}
                >
                  <Info className="h-4 w-4" />
                </Button>
              ) : null}
              <Button
                variant="primary"
                size="sm"
                className="flex-1"
                onClick={() => onCreateOrder(candidate)}
                title={
                  candidate.recommendation?.verdict === 'NOT_RECOMMENDED'
                    ? t('dailyReview.table.candidates.createOrderNotRecommendedTitle')
                    : t('dailyReview.table.candidates.createOrderTitle')
                }
              >
                {t('dailyReview.table.candidates.createOrder')}
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <TableShell
      empty={candidates.length === 0}
      emptyMessage={t('dailyReview.table.candidates.empty')}
      tableClassName="text-sm"
      headers={(
        <tr>
          <th className="text-left p-2">{t('dailyReview.table.candidates.headers.ticker')}</th>
          <th className="text-right p-2">
            <MetricHelpLabel metricKey="CONFIDENCE" className="justify-end w-full" />
          </th>
          <th className="text-left p-2">{t('dailyReview.table.candidates.headers.signal')}</th>
          <th className="text-right p-2">{t('dailyReview.table.candidates.headers.entry')}</th>
          <th className="text-right p-2">{t('dailyReview.table.candidates.headers.stop')}</th>
          <th className="text-right p-2">{t('dailyReview.table.candidates.headers.shares')}</th>
          <th className="text-right p-2">
            <MetricHelpLabel metricKey="RR" labelOverride="R:R" className="justify-end w-full" />
          </th>
          <th className="text-left p-2">{t('dailyReview.table.candidates.headers.sector')}</th>
          <th className="text-center p-2">{t('dailyReview.table.candidates.headers.info')}</th>
          <th className="text-right p-2">{t('dailyReview.table.candidates.headers.action')}</th>
        </tr>
      )}
    >
      {candidates.map((candidate) => (
        <tr key={candidate.ticker} className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
          <td className="p-2 font-mono font-bold">
            <a
              href={`https://finance.yahoo.com/quote/${candidate.ticker}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline"
              title={t('dailyReview.table.candidates.yahooFinanceTooltip', { ticker: candidate.ticker })}
            >
              {candidate.ticker}
            </a>
            <DailyReviewWatchInlineBlock
              ticker={candidate.ticker}
              currentPrice={candidate.close}
              source="daily_review_candidates"
              watchItemsByTicker={watchItemsByTicker}
              watchPending={watchPending}
              onWatch={onWatch}
              onUnwatch={onUnwatch}
            />
            <CachedSymbolPriceChart ticker={candidate.ticker} className="mt-1" />
          </td>
          <td className="p-2 text-right">
            <span className="font-semibold text-purple-600">
              {candidate.confidence != null ? formatNumber(candidate.confidence, 1) : '-'}
            </span>
          </td>
          <td className="p-2">
            <Badge variant="primary">{candidate.signal}</Badge>
          </td>
          <td className="p-2 text-right">{formatCurrency(candidate.entry)}</td>
          <td className="p-2 text-right">{formatCurrency(candidate.stop)}</td>
          <td className="p-2 text-right">{candidate.shares}</td>
          <td className="p-2 text-right font-bold">
            {t('common.units.rValue', { value: formatNumber(candidate.rReward, 1) })}
          </td>
          <td className="p-2 text-sm text-gray-600 dark:text-gray-400">
            {candidate.sector || t('common.placeholders.dash')}
          </td>
          <td className="p-2 text-center">
            {candidate.recommendation ? (
              <button
                onClick={() => onShowRecommendation(candidate)}
                className="min-h-11 min-w-11 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                title={t('dailyReview.table.candidates.recommendationTitle')}
                aria-label={t('dailyReview.table.candidates.recommendationAria', { ticker: candidate.ticker })}
              >
                <Info className="w-4 h-4" />
              </button>
            ) : null}
          </td>
          <td className="p-2 text-right">
            <Button
              variant="primary"
              size="sm"
              onClick={() => onCreateOrder(candidate)}
              title={
                candidate.recommendation?.verdict === 'NOT_RECOMMENDED'
                  ? t('dailyReview.table.candidates.createOrderNotRecommendedTitle')
                  : t('dailyReview.table.candidates.createOrderTitle')
              }
            >
              {t('dailyReview.table.candidates.createOrder')}
            </Button>
          </td>
        </tr>
      ))}
    </TableShell>
  );
}
