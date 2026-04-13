import MetricHelpLabel from '@/components/domain/education/MetricHelpLabel';
import RecommendationSummary from '@/components/domain/recommendation/RecommendationSummary';
import type { RecommendationEducationVM } from '@/features/recommendation/educationViewModel';
import { formatCurrency, formatRatioAsPercent } from '@/utils/formatters';
import type { Recommendation } from '@/types/recommendation';
import { t } from '@/i18n/t';

interface RecommendationSectionProps {
  recommendation?: Recommendation;
  currency?: string;
  educationView?: RecommendationEducationVM;
  deterministicFacts?: Record<string, string>;
}

export default function RecommendationSection({
  recommendation,
  currency = 'USD',
  educationView,
  deterministicFacts,
}: RecommendationSectionProps) {
  if (!recommendation) {
    return (
      <div className="text-center py-8 text-gray-600 dark:text-gray-400">
        <p>{t('recommendation.noDetails')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <RecommendationSummary recommendation={recommendation} />

      <details className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-4" open>
        <summary className="cursor-pointer font-semibold">
          {t('recommendation.sections.checklist')}
        </summary>
        <div className="mt-3 space-y-2 text-sm">
          {recommendation.checklist?.length ? (
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
              {recommendation.risk?.entry != null
                ? formatCurrency(recommendation.risk.entry, currency)
                : t('common.placeholders.emDash')}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">{t('recommendation.labels.stop')}</div>
            <div className="font-semibold">
              {recommendation.risk?.stop != null
                ? formatCurrency(recommendation.risk.stop, currency)
                : t('common.placeholders.emDash')}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">{t('recommendation.labels.target')}</div>
            <div className="font-semibold">
              {recommendation.risk?.target != null
                ? formatCurrency(recommendation.risk.target, currency)
                : t('common.placeholders.emDash')}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">
              <MetricHelpLabel metricKey="RR" />
            </div>
            <div className="font-semibold">
              {recommendation.risk?.rr != null ? recommendation.risk.rr.toFixed(2) : t('common.placeholders.emDash')}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">{t('recommendation.labels.riskAmount')}</div>
            <div className="font-semibold">
              {recommendation.risk?.riskAmount != null
                ? formatCurrency(recommendation.risk.riskAmount, currency)
                : t('common.placeholders.emDash')}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">
              <MetricHelpLabel metricKey="RISK_PCT" />
            </div>
            <div className="font-semibold">
              {recommendation.risk?.riskPct != null
                ? formatRatioAsPercent(recommendation.risk.riskPct)
                : t('common.placeholders.emDash')}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">{t('recommendation.labels.positionSize')}</div>
            <div className="font-semibold">
              {recommendation.risk?.positionSize != null
                ? formatCurrency(recommendation.risk.positionSize, currency)
                : t('common.placeholders.emDash')}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">{t('recommendation.labels.shares')}</div>
            <div className="font-semibold">
              {recommendation.risk?.shares != null ? recommendation.risk.shares : t('common.placeholders.emDash')}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">
              {t('recommendation.labels.feesEstimated')}
            </div>
            <div className="font-semibold">
              {recommendation.costs?.totalCost != null
                ? formatCurrency(recommendation.costs.totalCost, currency)
                : t('common.placeholders.emDash')}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">
              <MetricHelpLabel metricKey="FEE_TO_RISK" />
            </div>
            <div className="font-semibold">
              {recommendation.costs?.feeToRiskPct != null
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
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
            <p className="text-sm font-semibold text-blue-900">{educationView?.title ?? t('recommendation.summary')}</p>
            <p className="mt-1 text-sm text-blue-900">{educationView?.summary ?? t('common.placeholders.emDash')}</p>
            {educationView?.source ? (
              <p className="mt-1 text-xs text-blue-700">
                {educationView.source === 'llm'
                  ? t('tradeInsight.education.sourceLlm')
                  : t('tradeInsight.education.sourceFallback')}
              </p>
            ) : null}
          </div>

          {educationView?.bullets?.length ? (
            <div>
              <div className="text-gray-500 dark:text-gray-400">{t('tradeInsight.education.whyNow')}</div>
              <ul className="list-disc ml-5 mt-1 space-y-1">
                {educationView.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {educationView?.watchouts?.length ? (
            <div>
              <div className="text-gray-500 dark:text-gray-400">{t('tradeInsight.education.watchouts')}</div>
              <ul className="list-disc ml-5 mt-1 space-y-1">
                {educationView.watchouts.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {educationView?.nextSteps?.length ? (
            <div>
              <div className="text-gray-500 dark:text-gray-400">{t('tradeInsight.education.nextSteps')}</div>
              <ul className="list-disc ml-5 mt-1 space-y-1">
                {educationView.nextSteps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </details>

      {deterministicFacts && Object.keys(deterministicFacts).length > 0 ? (
        <details className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-4">
          <summary className="cursor-pointer font-semibold">
            {t('tradeInsight.education.deterministicFacts')}
          </summary>
          <div className="mt-3 text-xs space-y-1">
            {Object.entries(deterministicFacts).map(([key, value]) => (
              <div key={key} className="flex items-start gap-2">
                <span className="font-mono text-gray-500 dark:text-gray-400">{key}</span>
                <span className="text-gray-700 dark:text-gray-300">{value}</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
