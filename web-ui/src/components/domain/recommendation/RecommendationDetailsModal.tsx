import ModalShell from '@/components/common/ModalShell';
import MetricHelpLabel from '@/components/domain/education/MetricHelpLabel';
import RecommendationSummary from '@/components/domain/recommendation/RecommendationSummary';
import { formatCurrency, formatRatioAsPercent } from '@/utils/formatters';
import type { Recommendation } from '@/types/recommendation';
import { t } from '@/i18n/t';

interface RecommendationDetailsModalProps {
  ticker: string;
  recommendation?: Recommendation;
  currency?: 'USD' | 'EUR';
  onClose: () => void;
}

export default function RecommendationDetailsModal({
  ticker,
  recommendation,
  currency = 'USD',
  onClose,
}: RecommendationDetailsModalProps) {
  return (
    <ModalShell
      title={t('recommendation.details.title', { ticker })}
      onClose={onClose}
      className="max-w-3xl"
      closeAriaLabel={t('modal.closeAria')}
    >
      <div className="space-y-4">
        <RecommendationSummary recommendation={recommendation} />

        <details className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-4" open>
          <summary className="cursor-pointer font-semibold">
            {t('recommendation.sections.checklist')}
          </summary>
          <div className="mt-3 space-y-2 text-sm">
            {recommendation?.checklist?.length ? (
              recommendation.checklist.map((gate) => (
                <div key={gate.gateName} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 h-2 w-2 rounded-full ${
                      gate.passed ? 'bg-green-600' : 'bg-red-600'
                    }`}
                  />
                  <div>
                    <div className="font-medium">{gate.gateName}</div>
                    <div className="text-gray-600 dark:text-gray-400">{gate.explanation}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-gray-600 dark:text-gray-400">{t('recommendation.noDetails')}</div>
            )}
          </div>
        </details>

        <details className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-4">
          <summary className="cursor-pointer font-semibold">
            {t('recommendation.sections.riskCosts')}
          </summary>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-gray-500 dark:text-gray-400">{t('recommendation.labels.entry')}</div>
              <div className="font-semibold">
                {recommendation?.risk?.entry != null
                  ? formatCurrency(recommendation.risk.entry, currency)
                  : t('common.placeholders.emDash')}
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">{t('recommendation.labels.stop')}</div>
              <div className="font-semibold">
                {recommendation?.risk?.stop != null
                  ? formatCurrency(recommendation.risk.stop, currency)
                  : t('common.placeholders.emDash')}
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">{t('recommendation.labels.target')}</div>
              <div className="font-semibold">
                {recommendation?.risk?.target != null
                  ? formatCurrency(recommendation.risk.target, currency)
                  : t('common.placeholders.emDash')}
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">
                <MetricHelpLabel metricKey="RR" />
              </div>
              <div className="font-semibold">
                {recommendation?.risk?.rr != null ? recommendation.risk.rr.toFixed(2) : t('common.placeholders.emDash')}
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">{t('recommendation.labels.riskAmount')}</div>
              <div className="font-semibold">
                {recommendation?.risk?.riskAmount != null
                  ? formatCurrency(recommendation.risk.riskAmount, currency)
                  : t('common.placeholders.emDash')}
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">
                <MetricHelpLabel metricKey="RISK_PCT" />
              </div>
              <div className="font-semibold">
                {recommendation?.risk?.riskPct != null
                  ? formatRatioAsPercent(recommendation.risk.riskPct)
                  : t('common.placeholders.emDash')}
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">{t('recommendation.labels.positionSize')}</div>
              <div className="font-semibold">
                {recommendation?.risk?.positionSize != null
                  ? formatCurrency(recommendation.risk.positionSize, currency)
                  : t('common.placeholders.emDash')}
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">{t('recommendation.labels.shares')}</div>
              <div className="font-semibold">
                {recommendation?.risk?.shares != null ? recommendation.risk.shares : t('common.placeholders.emDash')}
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">
                {t('recommendation.labels.feesEstimated')}
              </div>
              <div className="font-semibold">
                {recommendation?.costs?.totalCost != null
                  ? formatCurrency(recommendation.costs.totalCost, currency)
                  : t('common.placeholders.emDash')}
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">
                <MetricHelpLabel metricKey="FEE_TO_RISK" />
              </div>
              <div className="font-semibold">
                {recommendation?.costs?.feeToRiskPct != null
                  ? formatRatioAsPercent(recommendation.costs.feeToRiskPct)
                  : t('common.placeholders.emDash')}
              </div>
            </div>
          </div>
        </details>

        <details className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-4">
          <summary className="cursor-pointer font-semibold">
            {t('recommendation.sections.education')}
          </summary>
          <div className="mt-3 text-sm space-y-2">
            <div>
              <div className="text-gray-500 dark:text-gray-400">
                {t('recommendation.labels.biasWarning')}
              </div>
              <div className="font-medium">{recommendation?.education?.commonBiasWarning ?? t('common.placeholders.emDash')}</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">
                {t('recommendation.labels.whatToLearn')}
              </div>
              <div className="font-medium">{recommendation?.education?.whatToLearn ?? t('common.placeholders.emDash')}</div>
            </div>
            {recommendation?.education?.whatWouldMakeValid?.length ? (
              <div>
                <div className="text-gray-500 dark:text-gray-400">
                  {t('recommendation.labels.whatWouldMakeValid')}
                </div>
                <ul className="list-disc ml-5 mt-1 space-y-1">
                  {recommendation.education.whatWouldMakeValid.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
      </div>
    </ModalShell>
  );
}
