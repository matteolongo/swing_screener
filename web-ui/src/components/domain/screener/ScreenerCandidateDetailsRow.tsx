import { CandidateViewModel } from '@/features/screener/viewModel';
import MetricHelpLabel from '@/components/domain/education/MetricHelpLabel';
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
    <tr className="bg-gray-50 dark:bg-gray-800">
      <td colSpan={6} className="px-4 py-3">
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            {t('screener.details.advancedMetrics')}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
            <div className="rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
              <MetricHelpLabel metricKey="SCORE" className="text-gray-600 dark:text-gray-400" />
              <div className="font-mono mt-1 text-base">{formatScreenerScore(candidate.score)}</div>
            </div>
            <div className="rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
              <MetricHelpLabel metricKey="ATR" className="text-gray-600 dark:text-gray-400" />
              <div className="font-mono mt-1 text-base">{candidate.atr != null ? candidate.atr.toFixed(2) : '—'}</div>
            </div>
            <div className="rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
              <MetricHelpLabel metricKey="MOM_6M" className="text-gray-600 dark:text-gray-400" />
              <div className="font-mono mt-1 text-base">{candidate.momentum6m != null ? formatPercent(candidate.momentum6m * 100) : '—'}</div>
            </div>
            <div className="rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
              <MetricHelpLabel metricKey="MOM_12M" className="text-gray-600 dark:text-gray-400" />
              <div className="font-mono mt-1 text-base">{candidate.momentum12m != null ? formatPercent(candidate.momentum12m * 100) : '—'}</div>
            </div>
            <div className="rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
              <MetricHelpLabel metricKey="RS" className="text-gray-600 dark:text-gray-400" />
              <div className="font-mono mt-1 text-base">{candidate.relStrength != null ? formatPercent(candidate.relStrength * 100) : '—'}</div>
            </div>
            {candidate.volumeRatio != null && (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
                  {t('screener.details.volumeRatio.label')}
                </p>
                <div
                  className={`font-mono mt-1 text-base ${
                    candidate.volumeRatio >= 1.5
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : candidate.volumeRatio < 0.9
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-gray-900 dark:text-gray-100'
                  }`}
                >
                  {volumeLabel(candidate.volumeRatio)}
                </div>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
