import { CandidateViewModel, hasOverlayData } from '@/features/screener/viewModel';
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
  return (
    <tr className="bg-gray-50 dark:bg-gray-800">
      <td colSpan={7} className="px-4 py-4">
        <div className="space-y-4">
          {/* Advanced Metrics Section */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t('screener.details.advancedMetrics')}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {/* Score */}
              <div>
                <MetricHelpLabel metricKey="SCORE" className="text-gray-600 dark:text-gray-400" />
                <div className="font-mono mt-1">{candidate.score.toFixed(1)}</div>
              </div>

              {/* ATR */}
              <div>
                <MetricHelpLabel metricKey="ATR" className="text-gray-600 dark:text-gray-400" />
                <div className="font-mono mt-1">{candidate.atr.toFixed(2)}</div>
              </div>

              {/* Mom 6M */}
              <div>
                <MetricHelpLabel metricKey="MOM_6M" className="text-gray-600 dark:text-gray-400" />
                <div className="font-mono mt-1">{formatPercent(candidate.momentum6m * 100)}</div>
              </div>

              {/* Mom 12M */}
              <div>
                <MetricHelpLabel metricKey="MOM_12M" className="text-gray-600 dark:text-gray-400" />
                <div className="font-mono mt-1">{formatPercent(candidate.momentum12m * 100)}</div>
              </div>

              {/* RS */}
              <div>
                <MetricHelpLabel metricKey="RS" className="text-gray-600 dark:text-gray-400" />
                <div className="font-mono mt-1">{formatPercent(candidate.relStrength * 100)}</div>
              </div>
            </div>
          </div>

          {/* Overlay Information Section */}
          {hasOverlayData(candidate) && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t('screener.details.overlayInfo')}
              </h4>
              <div className="space-y-2 text-sm">
                {/* Overlay status */}
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-400">
                    {t('screener.table.overlayStatusTitle', { status: candidate.overlayStatus })}
                  </span>
                  <OverlayBadge status={candidate.overlayStatus} />
                </div>

                {/* Overlay reasons */}
                {candidate.overlayReasons.length > 0 && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">
                      {t('screener.table.overlayReasons', { reasons: candidate.overlayReasons.join(', ') })}
                    </span>
                  </div>
                )}

                {/* Additional overlay metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                  {candidate.overlayAttentionZ != null && (
                    <div className="text-xs">
                      {t('screener.table.overlayAttentionZ', { value: candidate.overlayAttentionZ.toFixed(2) })}
                    </div>
                  )}
                  {candidate.overlaySentimentScore != null && (
                    <div className="text-xs">
                      {t('screener.table.overlaySentiment', { value: candidate.overlaySentimentScore.toFixed(2) })}
                    </div>
                  )}
                  {candidate.overlayHypeScore != null && (
                    <div className="text-xs">
                      {t('screener.table.overlayHype', { value: candidate.overlayHypeScore.toFixed(2) })}
                    </div>
                  )}
                  {candidate.overlaySampleSize != null && (
                    <div className="text-xs">
                      {t('screener.table.overlaySample', { value: candidate.overlaySampleSize })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* No overlay data message */}
          {!hasOverlayData(candidate) && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t('screener.details.overlayInfo')}
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('screener.details.noOverlayData')}
              </p>
            </div>
          )}

          {/* Secondary Actions Section */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t('screener.details.secondaryActions')}
            </h4>
            <div className="flex gap-2">
              {/* Sentiment Analysis */}
              <button
                type="button"
                onClick={onSocialClick}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                title={t('screener.table.sentimentTitle')}
                aria-label={t('screener.table.sentimentAria', { ticker: candidate.ticker })}
              >
                {t('screener.table.sentimentTitle')}
              </button>

              {/* Trade Thesis */}
              {candidate.original.recommendation?.thesis && (
                <button
                  type="button"
                  onClick={onThesisClick}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  title={t('screener.table.tradeThesisTitle')}
                  aria-label={t('screener.table.tradeThesisAria', { ticker: candidate.ticker })}
                >
                  {t('screener.table.tradeThesisTitle')}
                </button>
              )}

              {/* Quick Backtest */}
              <button
                type="button"
                onClick={onBacktestClick}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                title={t('screener.table.quickBacktestTitle')}
              >
                {t('screener.table.quickBacktestTitle')}
              </button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
