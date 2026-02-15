import { CandidateViewModel, hasOverlayData } from '@/features/screener/viewModel';
import { BarChart3, FlaskConical, MessageCircle, Sparkles } from 'lucide-react';
import MetricHelpLabel from '@/components/domain/education/MetricHelpLabel';
import OverlayBadge from '@/components/domain/recommendation/OverlayBadge';
import { formatPercent } from '@/utils/formatters';
import { t } from '@/i18n/t';

interface ScreenerCandidateDetailsRowProps {
  candidate: CandidateViewModel;
  onSocialClick: () => void;
  onThesisClick: () => void;
  onBacktestClick: () => void;
}

/**
 * Expandable detail row showing advanced metrics, overlay info, and secondary actions
 */
export default function ScreenerCandidateDetailsRow({
  candidate,
  onSocialClick,
  onThesisClick,
  onBacktestClick,
}: ScreenerCandidateDetailsRowProps) {
  const overlayClassByStatus: Record<string, string> = {
    OFF: 'bg-gray-50 border-gray-200',
    OK: 'bg-emerald-50 border-emerald-200',
    VETO: 'bg-rose-50 border-rose-200',
    PENDING: 'bg-amber-50 border-amber-200',
  };

  return (
    <tr className="bg-gray-50 dark:bg-gray-800">
      <td colSpan={7} className="px-4 py-4">
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            {/* Advanced metrics */}
            <div className="xl:col-span-8 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                {t('screener.details.advancedMetrics')}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 text-sm">
                <div className="rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
                  <MetricHelpLabel metricKey="SCORE" className="text-gray-600 dark:text-gray-400" />
                  <div className="font-mono mt-1 text-base">{candidate.score.toFixed(1)}</div>
                </div>
                <div className="rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
                  <MetricHelpLabel metricKey="ATR" className="text-gray-600 dark:text-gray-400" />
                  <div className="font-mono mt-1 text-base">{candidate.atr.toFixed(2)}</div>
                </div>
                <div className="rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
                  <MetricHelpLabel metricKey="MOM_6M" className="text-gray-600 dark:text-gray-400" />
                  <div className="font-mono mt-1 text-base">{formatPercent(candidate.momentum6m * 100)}</div>
                </div>
                <div className="rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
                  <MetricHelpLabel metricKey="MOM_12M" className="text-gray-600 dark:text-gray-400" />
                  <div className="font-mono mt-1 text-base">{formatPercent(candidate.momentum12m * 100)}</div>
                </div>
                <div className="rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
                  <MetricHelpLabel metricKey="RS" className="text-gray-600 dark:text-gray-400" />
                  <div className="font-mono mt-1 text-base">{formatPercent(candidate.relStrength * 100)}</div>
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="xl:col-span-4 rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 dark:border-blue-800 dark:from-blue-950/30 dark:to-indigo-950/20">
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-3">
                {t('screener.details.secondaryActions')}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={onSocialClick}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-300 bg-white px-3 py-2 text-sm text-blue-800 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-200 dark:hover:bg-blue-900/30"
                  title={t('screener.table.sentimentTitle')}
                  aria-label={t('screener.table.sentimentAria', { ticker: candidate.ticker })}
                >
                  <MessageCircle className="h-4 w-4" />
                  {t('screener.table.sentimentTitle')}
                </button>

                {candidate.original.recommendation?.thesis && (
                  <button
                    type="button"
                    onClick={onThesisClick}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-900/30"
                    title={t('screener.table.tradeThesisTitle')}
                    aria-label={t('screener.table.tradeThesisAria', { ticker: candidate.ticker })}
                  >
                    <Sparkles className="h-4 w-4" />
                    {t('screener.table.tradeThesisTitle')}
                  </button>
                )}

                <button
                  type="button"
                  onClick={onBacktestClick}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-violet-300 bg-white px-3 py-2 text-sm text-violet-800 hover:bg-violet-50 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-200 dark:hover:bg-violet-900/30"
                  title={t('screener.table.quickBacktestTitle')}
                >
                  <BarChart3 className="h-4 w-4" />
                  {t('screener.table.quickBacktestTitle')}
                </button>
              </div>
            </div>
          </div>

          {/* Overlay information */}
          {hasOverlayData(candidate) ? (
            <div
              className={`rounded-lg border p-4 ${
                overlayClassByStatus[candidate.overlayStatus] ?? overlayClassByStatus.OFF
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {t('screener.details.overlayInfo')}
                </h4>
                <OverlayBadge status={candidate.overlayStatus} />
              </div>

              <div className="space-y-2 text-sm">
                {candidate.overlayReasons.length > 0 && (
                  <div className="inline-flex items-center gap-2 rounded-md bg-white/60 px-2 py-1 text-gray-700 dark:bg-gray-900/30 dark:text-gray-200">
                    <FlaskConical className="h-4 w-4" />
                    <span>
                      {t('screener.table.overlayReasons', { reasons: candidate.overlayReasons.join(', ') })}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                  {candidate.overlayAttentionZ != null && (
                    <div className="rounded-md bg-white/70 px-2 py-1 text-xs text-gray-700 dark:bg-gray-900/30 dark:text-gray-200">
                      {t('screener.table.overlayAttentionZ', { value: candidate.overlayAttentionZ.toFixed(2) })}
                    </div>
                  )}
                  {candidate.overlaySentimentScore != null && (
                    <div className="rounded-md bg-white/70 px-2 py-1 text-xs text-gray-700 dark:bg-gray-900/30 dark:text-gray-200">
                      {t('screener.table.overlaySentiment', { value: candidate.overlaySentimentScore.toFixed(2) })}
                    </div>
                  )}
                  {candidate.overlayHypeScore != null && (
                    <div className="rounded-md bg-white/70 px-2 py-1 text-xs text-gray-700 dark:bg-gray-900/30 dark:text-gray-200">
                      {t('screener.table.overlayHype', { value: candidate.overlayHypeScore.toFixed(2) })}
                    </div>
                  )}
                  {candidate.overlaySampleSize != null && (
                    <div className="rounded-md bg-white/70 px-2 py-1 text-xs text-gray-700 dark:bg-gray-900/30 dark:text-gray-200">
                      {t('screener.table.overlaySample', { value: candidate.overlaySampleSize })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t('screener.details.overlayInfo')}
              </h4>
              <p className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <FlaskConical className="h-4 w-4" />
                {t('screener.details.noOverlayData')}
              </p>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
