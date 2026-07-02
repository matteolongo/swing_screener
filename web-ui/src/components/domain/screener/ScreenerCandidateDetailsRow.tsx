import { CandidateViewModel } from '@/features/screener/viewModel';
import { getGlossaryEntry } from '@/content/educationGlossary';
import WeeklyTrendBadge from './WeeklyTrendBadge';
import { formatPercent, formatScreenerScore } from '@/utils/formatters';
import { t } from '@/i18n/t';

interface ScreenerCandidateDetailsRowProps {
  candidate: CandidateViewModel;
}

function volumeLabel(ratio: number): string {
  if (ratio >= 1.5) return t('screener.details.volumeRatio.strong', { value: ratio.toFixed(2) });
  if (ratio < 0.9) return t('screener.details.volumeRatio.weak', { value: ratio.toFixed(2) });
  return t('screener.details.volumeRatio.neutral', { value: ratio.toFixed(2) });
}

/**
 * Expandable detail row showing advanced metrics
 */
export default function ScreenerCandidateDetailsRow({ candidate }: ScreenerCandidateDetailsRowProps) {
  return (
    <tr className="bg-foreground/5">
      <td colSpan={6} className="px-4 py-3">
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
            {t('screener.details.advancedMetrics')}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
            <div className="rounded-md border border-border bg-foreground/5 p-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
                {getGlossaryEntry('SCORE').label}
              </p>
              <div className="font-mono mt-1 text-base">{formatScreenerScore(candidate.score)}</div>
            </div>
            <div className="rounded-md border border-border bg-foreground/5 p-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
                {getGlossaryEntry('ATR').label}
              </p>
              <div className="font-mono mt-1 text-base">{candidate.atr != null ? candidate.atr.toFixed(2) : '—'}</div>
            </div>
            <div className="rounded-md border border-border bg-foreground/5 p-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
                {getGlossaryEntry('MOM_6M').label}
              </p>
              <div className="font-mono mt-1 text-base">{candidate.momentum6m != null ? formatPercent(candidate.momentum6m * 100) : '—'}</div>
            </div>
            <div className="rounded-md border border-border bg-foreground/5 p-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
                {getGlossaryEntry('MOM_12M').label}
              </p>
              <div className="font-mono mt-1 text-base">{candidate.momentum12m != null ? formatPercent(candidate.momentum12m * 100) : '—'}</div>
            </div>
            <div className="rounded-md border border-border bg-foreground/5 p-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
                {getGlossaryEntry('RS').label}
              </p>
              <div className="font-mono mt-1 text-base">{candidate.relStrength != null ? formatPercent(candidate.relStrength * 100) : '—'}</div>
            </div>
            {candidate.volumeRatio != null && (
              <div className="rounded-md border border-border bg-foreground/5 p-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
                  {t('screener.details.volumeRatio.label')}
                </p>
                <div
                  className={`font-mono mt-1 text-base ${
                    candidate.volumeRatio >= 1.5
                      ? 'text-success'
                      : candidate.volumeRatio < 0.9
                        ? 'text-warning'
                        : 'text-foreground'
                  }`}
                >
                  {volumeLabel(candidate.volumeRatio)}
                </div>
              </div>
            )}
            {candidate.weeklyTrend != null && (
              <div className="rounded-md border border-border bg-foreground/5 p-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
                  {t('screener.details.weeklyTrend.label')}
                </p>
                <div className="mt-1">
                  <WeeklyTrendBadge trend={candidate.weeklyTrend} />
                </div>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
