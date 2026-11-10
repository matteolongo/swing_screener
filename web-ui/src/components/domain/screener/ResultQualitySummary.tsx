import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, ChevronRight, CheckCircle2 } from 'lucide-react';
import type { ScreenerResponse } from '@/features/screener/types';
import { getResultCandleDates, getResultMarketStatus, marketDate, summarizeResultQuality } from '@/features/screener/resultQuality';
import { t } from '@/i18n/t';
import { formatDateTime } from '@/utils/formatters';
import { cn } from '@/utils/cn';

export default function ResultQualitySummary({ result, completedAt, isRefreshing, error, source }: {
  result: ScreenerResponse | null;
  completedAt?: string;
  isRefreshing: boolean;
  error: Error | null;
  source?: string;
}) {
  if (!result) return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 text-sm text-muted">
      <Activity className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      <p role="status">{t(isRefreshing ? 'screener.quality.initialLoading' : 'screener.quality.unavailable')}</p>
    </div>
  );
  const marketStatus = getResultMarketStatus(result);
  const dates = getResultCandleDates(result);
  const warnings = result.warnings ?? [];
  const countsKnown = Number.isFinite(result.totalScreened) && Number.isFinite(result.totalWithMarketData);
  const quality = countsKnown ? summarizeResultQuality({ requested: result.totalScreened,
    evaluated: result.totalWithMarketData!, warnings, marketStatus }) : null;
  const complete = marketStatus === 'final_close' && quality?.coverage === 'complete' && !error && warnings.length === 0;
  const StatusIcon = complete ? CheckCircle2 : AlertTriangle;
  return (
    <section aria-label={t('screener.quality.title')} className="rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-start gap-3 px-4 py-4">
        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', complete ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning')}>
          <StatusIcon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{t('cockpit.review.scanTitle')}</h2>
          <p className="mt-1 break-words text-sm text-muted">{source}</p>
          {error ? <p role="status" className="mt-1 text-sm text-warning">{t('screener.quality.cachedAfterFailure')}</p>
            : isRefreshing ? <p role="status" className="mt-1 text-sm text-muted">{t('screener.quality.previousWhileRefreshing')}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <span className={cn('rounded-full px-2.5 py-1', marketStatus === 'final_close' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning')}>
            {t(`screener.quality.market.${marketStatus}`)}
          </span>
          <span className={cn('rounded-full px-2.5 py-1', quality?.coverage === 'complete' ? 'bg-foreground/5 text-muted' : 'bg-warning/10 text-warning')}>
            {t(quality ? `screener.quality.${quality.coverage}` : 'screener.quality.coverageUnavailable')}
          </span>
          {warnings.length > 0 ? <span className="rounded-full bg-warning/10 px-2.5 py-1 text-warning">{t('screener.quality.warnings')}</span> : null}
        </div>
      </div>
      <details className="group border-t border-border">
        <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 text-sm marker:content-none [&::-webkit-details-marker]:hidden">
          <ChevronRight className="h-4 w-4 text-muted group-open:rotate-90" aria-hidden="true" />
          <span className="font-medium">{t('cockpit.review.scanDetails')}</span>
          <span className="text-xs text-muted sm:ml-auto">{t('screener.quality.sessionDate', { date: marketDate(result.asofDate) ?? t('screener.quality.unknownDate') })}</span>
        </summary>
        <div className="space-y-2 border-t border-border px-4 py-3 text-sm">
          {countsKnown ? <p>{t('screener.quality.counts', { requested: result.totalScreened, evaluated: result.totalWithMarketData!, matched: result.totalReturnedCandidates ?? result.candidates.length })}</p> : null}
          <p className="text-xs text-muted">{t('screener.quality.countsHelp')}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span>{dates.length > 1
              ? t('screener.quality.candleDates', { first: dates[0], last: dates[dates.length - 1] })
              : t('screener.quality.candleDate', { date: dates[0] ?? t('screener.quality.unknownDate') })}</span>
            {completedAt ? <span>{t('screener.quality.requestCompleted', { time: formatDateTime(completedAt) })}</span> : null}
          </div>
          {warnings.length > 0 ? <div role="note" aria-label={t('screener.quality.warnings')} className="space-y-1">
            <ul className="list-disc space-y-1 break-words pl-5 text-xs">{warnings.map((warning, index) => <li key={`${index}:${warning}`}>{warning}</li>)}</ul>
          </div> : null}
          <Link to="/datasources" className="inline-flex min-h-11 items-center text-primary underline">{t('screener.quality.providerDetails')}</Link>
        </div>
      </details>
    </section>
  );
}
