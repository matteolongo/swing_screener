import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import WeeklyLearningPrompts from '@/components/domain/journal/WeeklyLearningPrompts';
import { getCurrentWeekId } from '@/components/domain/weeklyReview/WeeklyReviewForm';
import { usePositions } from '@/features/portfolio/hooks';
import { useWeeklyReviews } from '@/features/weeklyReview/hooks';
import type { Position } from '@/features/portfolio/types';
import type { WeeklyReview } from '@/features/weeklyReview/api';
import { t } from '@/i18n/t';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import { cn } from '@/utils/cn';

function computeFinalR(position: Position): number | null {
  const initialRisk = position.initialRisk;
  if (!initialRisk || initialRisk <= 0) return null;
  if (position.exitPrice == null) return null;
  return (position.exitPrice - position.entryPrice) / initialRisk;
}

function computeMaxR(position: Position): number | null {
  const initialRisk = position.initialRisk;
  if (!initialRisk || initialRisk <= 0) return null;
  if (position.maxFavorablePrice == null) return null;
  return (position.maxFavorablePrice - position.entryPrice) / initialRisk;
}

function toWeekId(dateLike?: string) {
  if (!dateLike) {
    return null;
  }
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function RBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-gray-400">—</span>;
  const isPositive = value > 0;
  return (
    <span className={cn('font-semibold', isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
      {value > 0 ? '+' : ''}{formatNumber(value, 2)}R
    </span>
  );
}

function JournalRow({ position }: { position: Position }) {
  const [expanded, setExpanded] = useState(false);
  const finalR = computeFinalR(position);
  const maxR = computeMaxR(position);

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onClick={() => setExpanded((value) => !value)}
      >
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
          {expanded ? <ChevronDown className="inline h-4 w-4" /> : <ChevronRight className="inline h-4 w-4" />}
          <span className="ml-1">{position.exitDate ?? '—'}</span>
        </td>
        <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">{position.ticker}</td>
        <td className="px-4 py-3 text-sm text-right tabular-nums">{formatCurrency(position.entryPrice)}</td>
        <td className="px-4 py-3 text-sm text-right tabular-nums">
          {position.exitPrice != null ? formatCurrency(position.exitPrice) : '—'}
        </td>
        <td className="px-4 py-3 text-sm text-right tabular-nums"><RBadge value={finalR} /></td>
        <td className="px-4 py-3 text-sm text-right tabular-nums"><RBadge value={maxR} /></td>
      </tr>

      {expanded ? (
        <tr>
          <td colSpan={6} className="px-4 pb-4 pt-0 bg-gray-50 dark:bg-gray-800/30">
            <div className="grid gap-4 sm:grid-cols-3 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                  {t('journalPage.labels.thesis')}
                </p>
                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                  {position.thesis || t('journalPage.labels.noEntry')}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                  {t('journalPage.labels.notes')}
                </p>
                <pre className="whitespace-pre-wrap font-sans text-gray-800 dark:text-gray-200">
                  {position.notes || t('journalPage.labels.noEntry')}
                </pre>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                  {t('journalPage.labels.lesson')}
                </p>
                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                  {position.lesson || t('journalPage.labels.noEntry')}
                </p>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function PastReviews({ reviews }: { reviews: WeeklyReview[] }) {
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const currentWeekId = getCurrentWeekId();
  const pastReviews = reviews.filter((review) => review.week_id !== currentWeekId);

  if (pastReviews.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{t('journal.pastWeeks.noReviews')}</p>;
  }

  return (
    <div className="space-y-3">
      {pastReviews.map((review) => (
        <div key={review.week_id} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <button
            type="button"
            onClick={() => setExpandedWeek(expandedWeek === review.week_id ? null : review.week_id)}
            className="w-full bg-slate-50 dark:bg-slate-900 px-4 py-3 text-left text-sm font-medium flex items-center justify-between"
          >
            <span>{review.week_id}</span>
            <span>{expandedWeek === review.week_id ? '▲' : '▼'}</span>
          </button>
          {expandedWeek === review.week_id ? (
            <div className="grid gap-4 px-4 py-4 text-sm md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('journal.weeklyPrompts.whatWorked.label')}</p>
                <p className="mt-2">{review.what_worked || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('journal.weeklyPrompts.whatNeedsWork.label')}</p>
                <p className="mt-2">{review.what_didnt || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('journal.weeklyPrompts.lessonLearned.label')}</p>
                <p className="mt-2">{review.rules_violated || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('journal.weeklyPrompts.nextWeekFocus.label')}</p>
                <p className="mt-2">{review.next_week_focus || '—'}</p>
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function Journal() {
  const { data, isLoading, isError } = usePositions('closed');
  const reviewsQuery = useWeeklyReviews();

  const positions = (data ?? []).slice().sort((a, b) => {
    const da = a.exitDate ?? '';
    const db = b.exitDate ?? '';
    return db.localeCompare(da);
  });
  const currentWeekId = getCurrentWeekId();
  const currentWeekEntries = useMemo(
    () => positions.filter((position) => toWeekId(position.exitDate) === currentWeekId),
    [currentWeekId, positions],
  );

  const totalTrades = positions.length;
  const wins = positions.filter((position) => (computeFinalR(position) ?? 0) > 0).length;
  const losses = positions.filter((position) => (computeFinalR(position) ?? 0) < 0).length;
  const finalRValues = positions.map(computeFinalR).filter((value): value is number => value !== null);
  const maxRValues = positions.map(computeMaxR).filter((value): value is number => value !== null);
  const avgFinalR = finalRValues.length > 0 ? finalRValues.reduce((a, b) => a + b, 0) / finalRValues.length : null;
  const avgMaxR = maxRValues.length > 0 ? maxRValues.reduce((a, b) => a + b, 0) / maxRValues.length : null;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('journalPage.title')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('journalPage.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: t('journalPage.stats.totalTrades'), value: String(totalTrades) },
          { label: t('journalPage.stats.wins'), value: String(wins), positive: true },
          { label: t('journalPage.stats.losses'), value: String(losses), negative: true },
          { label: t('journalPage.stats.avgFinalR'), value: avgFinalR != null ? `${avgFinalR > 0 ? '+' : ''}${formatNumber(avgFinalR, 2)}R` : '—', rValue: avgFinalR },
          { label: t('journalPage.stats.avgMaxR'), value: avgMaxR != null ? `${formatNumber(avgMaxR, 2)}R` : '—', rValue: avgMaxR },
        ].map(({ label, value, positive, negative, rValue }) => (
          <div key={label} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
            <p className={cn(
              'mt-1 text-lg font-bold',
              positive ? 'text-green-600 dark:text-green-400' :
              negative ? 'text-red-600 dark:text-red-400' :
              rValue != null ? (rValue > 0 ? 'text-green-600 dark:text-green-400' : rValue < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100') :
              'text-gray-900 dark:text-gray-100'
            )}>
              {value}
            </p>
          </div>
        ))}
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{t('journal.thisWeek.title')}</h2>
        <WeeklyLearningPrompts />

        {!isLoading && !isError && currentWeekEntries.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('journal.thisWeek.noEntries')}</p>
        ) : null}

        {!isLoading && !isError && currentWeekEntries.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t('journalPage.columns.date')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t('journalPage.columns.ticker')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t('journalPage.columns.entry')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t('journalPage.columns.exit')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t('journalPage.columns.finalR')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t('journalPage.columns.maxR')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {currentWeekEntries.map((position) => (
                  <JournalRow key={position.positionId ?? `${position.ticker}-${position.exitDate}`} position={position} />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{t('journal.pastWeeks.title')}</h2>
        {reviewsQuery.data ? <PastReviews reviews={reviewsQuery.data} /> : null}
      </section>
    </div>
  );
}
