import { CandidateViewModel } from '@/features/screener/viewModel';
import { Sparkles } from 'lucide-react';
import MetricHelpLabel from '@/components/domain/education/MetricHelpLabel';
import { formatDateTime, formatPercent, formatScreenerScore } from '@/utils/formatters';
import { t } from '@/i18n/t';
import type { SymbolIntelligenceStatus } from '@/features/intelligence/useSymbolIntelligenceRunner';

interface ScreenerCandidateDetailsRowProps {
  candidate: CandidateViewModel;
  onThesisClick: () => void;
  onRunIntelligence: () => void;
  intelligenceStatus?: SymbolIntelligenceStatus;
}

/**
 * Expandable detail row showing advanced metrics and secondary actions
 */
export default function ScreenerCandidateDetailsRow({
  candidate,
  onThesisClick,
  onRunIntelligence,
  intelligenceStatus,
}: ScreenerCandidateDetailsRowProps) {
  return (
    <tr className="bg-gray-50 dark:bg-gray-800">
      <td colSpan={6} className="px-4 py-4">
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
                  <div className="font-mono mt-1 text-base">{formatScreenerScore(candidate.score)}</div>
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
                  onClick={onRunIntelligence}
                  disabled={intelligenceStatus?.stage === 'queued' || intelligenceStatus?.stage === 'running'}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-900/30"
                  title={t('screener.symbolIntelligence.runAction')}
                  aria-label={t('screener.symbolIntelligence.runAria', { ticker: candidate.ticker })}
                >
                  <Sparkles className="h-4 w-4" />
                  {intelligenceStatus?.stage === 'queued' || intelligenceStatus?.stage === 'running'
                    ? t('screener.symbolIntelligence.running')
                    : t('screener.symbolIntelligence.runAction')}
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

              </div>
              {intelligenceStatus ? (
                <div className="mt-2">
                  <p className="text-xs text-emerald-900 dark:text-emerald-200">
                    {intelligenceStatus.stage === 'completed'
                      ? t('screener.symbolIntelligence.completed', {
                          source:
                            intelligenceStatus.explanationSource === 'llm'
                              ? t('screener.symbolIntelligence.sourceLlm')
                              : t('screener.symbolIntelligence.sourceFallback'),
                        })
                      : intelligenceStatus.stage === 'error'
                        ? t('screener.symbolIntelligence.error', {
                            error: intelligenceStatus.error || t('screener.error.unknown'),
                          })
                        : intelligenceStatus.stage === 'queued'
                          ? t('screener.symbolIntelligence.queued')
                          : intelligenceStatus.stage === 'running'
                            ? t('screener.symbolIntelligence.running')
                            : t('screener.symbolIntelligence.idle')}
                  </p>
                  {intelligenceStatus.stage === 'completed' &&
                  (intelligenceStatus.explanationGeneratedAt || intelligenceStatus.updatedAt) ? (
                    <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">
                      {t('screener.symbolIntelligence.updatedAt', {
                        at: formatDateTime(
                          intelligenceStatus.explanationGeneratedAt || intelligenceStatus.updatedAt
                        ),
                      })}
                    </p>
                  ) : null}
                  {intelligenceStatus.stage === 'completed' && intelligenceStatus.warning ? (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      {t('screener.symbolIntelligence.warning', {
                        warning: intelligenceStatus.warning,
                      })}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
