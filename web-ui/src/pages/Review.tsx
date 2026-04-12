import { useMemo, useState } from 'react';
import PositionCaseStudyCard from '@/components/domain/review/PositionCaseStudyCard';
import { useDailyReview } from '@/features/dailyReview/api';
import { usePositions } from '@/features/portfolio/hooks';
import { buildPositionCaseStudy } from '@/features/review/reviewViewModel';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import { formatCurrency, formatNumber } from '@/utils/formatters';

type ReviewTab = 'open' | 'past';

function computeFinalR(entryPrice: number, exitPrice?: number | null, initialRisk?: number) {
  if (!initialRisk || initialRisk <= 0 || exitPrice == null) {
    return null;
  }
  return (exitPrice - entryPrice) / initialRisk;
}

export default function Review() {
  const [activeTab, setActiveTab] = useState<ReviewTab>('open');
  const openPositionsQuery = usePositions('open');
  const closedPositionsQuery = usePositions('closed');
  const reviewQuery = useDailyReview(200);

  const caseStudies = useMemo(() => {
    const reviewEntriesByTicker = new Map(
      [
        ...(reviewQuery.data?.positionsHold ?? []),
        ...(reviewQuery.data?.positionsUpdateStop ?? []),
        ...(reviewQuery.data?.positionsClose ?? []),
      ].map((entry) => [entry.ticker.toUpperCase(), entry]),
    );

    return (openPositionsQuery.data ?? []).map((position) =>
      buildPositionCaseStudy(position, reviewEntriesByTicker.get(position.ticker.toUpperCase())),
    );
  }, [openPositionsQuery.data, reviewQuery.data]);

  const closedPositions = (closedPositionsQuery.data ?? []).slice().sort((left, right) =>
    (right.exitDate ?? '').localeCompare(left.exitDate ?? ''),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">{t('sidebar.nav.review')}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Study open trades and recent outcomes before you make the next decision.
        </p>
      </div>

      <div className="flex gap-2">
        {[
          { key: 'open' as const, label: t('review.tabs.openPositions') },
          { key: 'past' as const, label: t('review.tabs.pastTrades') },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-primary/10 text-primary'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'open' ? (
        <div className="space-y-4">
          {caseStudies.map((caseStudy) => (
            <PositionCaseStudyCard
              key={caseStudy.position.positionId ?? caseStudy.position.ticker}
              caseStudy={caseStudy}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-semibold">{t('review.learningPrompts.title')}</h2>
            <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-300">
              <li>{t('review.learningPrompts.q1')}</li>
              <li>{t('review.learningPrompts.q2')}</li>
              <li>{t('review.learningPrompts.q3')}</li>
            </ul>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Ticker</th>
                  <th className="px-4 py-3 text-right">Entry</th>
                  <th className="px-4 py-3 text-right">Exit</th>
                  <th className="px-4 py-3 text-right">R</th>
                  <th className="px-4 py-3 text-left">Lesson</th>
                </tr>
              </thead>
              <tbody>
                {closedPositions.map((position) => {
                  const finalR = computeFinalR(position.entryPrice, position.exitPrice, position.initialRisk);
                  return (
                    <tr key={position.positionId ?? `${position.ticker}-${position.exitDate}`} className="border-t border-slate-200 dark:border-slate-700">
                      <td className="px-4 py-3">{position.exitDate ?? '—'}</td>
                      <td className="px-4 py-3 font-semibold">{position.ticker}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(position.entryPrice)}</td>
                      <td className="px-4 py-3 text-right">{position.exitPrice != null ? formatCurrency(position.exitPrice) : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {finalR != null ? `${finalR > 0 ? '+' : ''}${formatNumber(finalR, 2)}R` : '—'}
                      </td>
                      <td className="px-4 py-3">{position.lesson || position.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
