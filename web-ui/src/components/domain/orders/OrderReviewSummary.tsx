import RecommendationBadge from '@/components/domain/recommendation/RecommendationBadge';
import { getSetupExecutionGuidance } from '@/features/orders/setupGuidance';
import type {
  GeneratedEducationView,
  InvalidationRule,
  Recommendation,
  RecommendationRisk,
  RecommendationVerdict,
  TradeThesis,
} from '@/types/recommendation';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import { EmptySection, MetricTile, REVIEW_SECTIONS, type ReviewSectionId } from './orderReviewHelpers';

interface OrderReviewSummaryProps {
  activeSection: ReviewSectionId;
  onSectionChange: (section: ReviewSectionId) => void;
  recommendation?: Recommendation;
  verdict: RecommendationVerdict | 'UNKNOWN';
  reasonsDetailed?: Recommendation['reasonsDetailed'];
  isRecommended: boolean;
  isIncomplete: boolean;
  showManualOrderHint: boolean;
  knownCurrentPrice: number | null;
  currency: string;
  suggestedEntry: number;
  suggestedStop: number;
  suggestedShares: number;
  recRisk?: RecommendationRisk;
  contextShares?: number;
  contextRReward?: number;
  thesis?: TradeThesis;
  thesisEducation?: GeneratedEducationView;
  guidance: ReturnType<typeof getSetupExecutionGuidance>;
  warnings: string[];
  invalidationRules: InvalidationRule[];
  hardInvalidations: InvalidationRule[];
  softInvalidations: InvalidationRule[];
}

export default function OrderReviewSummary({
  activeSection,
  onSectionChange,
  recommendation,
  verdict,
  reasonsDetailed,
  isRecommended,
  isIncomplete,
  showManualOrderHint,
  knownCurrentPrice,
  currency,
  suggestedEntry,
  suggestedStop,
  suggestedShares,
  recRisk,
  contextShares,
  contextRReward,
  thesis,
  thesisEducation,
  guidance,
  warnings,
  invalidationRules,
  hardInvalidations,
  softInvalidations,
}: OrderReviewSummaryProps) {
  return (
    <section
      className="rounded-lg border border-border bg-foreground/5 p-3"
      aria-label={t('order.review.carouselLabel')}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t('order.review.kicker')}
            </p>
            <h3 className="text-base font-semibold text-foreground">
              {t('order.review.title' as any)}
            </h3>
            <p className="mt-1 text-sm text-muted">
              {t('order.review.subtitle' as any)}
            </p>
          </div>
        </div>

        <div
          className="flex w-full items-center gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1"
          role="tablist"
          aria-label={t('order.review.carouselLabel')}
        >
          {REVIEW_SECTIONS.map((section) => {
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                id={`order-review-tab-${section.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`order-review-panel-${section.id}`}
                onClick={() => onSectionChange(section.id)}
                className={cn(
                  'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-surface text-white shadow-sm'
                    : 'text-muted hover:text-foreground',
                )}
              >
                {t(section.titleKey as any)}
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-border bg-surface shadow-sm">
          <div
            id="order-review-panel-decision"
            role="tabpanel"
            aria-labelledby="order-review-tab-decision"
            hidden={activeSection !== 'decision'}
            className="p-4"
          >
            <div className="space-y-4">
              {recommendation ? (
                <div className={cn(
                  'rounded-xl border p-4',
                  isRecommended
                    ? 'border-success/40 bg-success/10'
                    : isIncomplete
                      ? 'border-warning/40 bg-warning/10'
                      : 'border-danger/40 bg-danger/10',
                )}>
                  <div className="flex flex-wrap items-center gap-2">
                    <RecommendationBadge verdict={verdict} reasonsDetailed={reasonsDetailed} />
                    <span className="text-sm text-muted">{t('recommendation.summary')}</span>
                  </div>
                  {recommendation.reasonsShort.length ? (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
                      {recommendation.reasonsShort.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : (
                !showManualOrderHint ? (
                  <EmptySection body={t('workspacePage.panels.analysis.manualOrderHint')} />
                ) : null
              )}

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricTile
                  label={t('order.candidateModal.labels.currentPrice')}
                  value={
                    knownCurrentPrice != null
                      ? formatCurrency(knownCurrentPrice, currency)
                      : t('common.placeholders.emDash')
                  }
                />
                <MetricTile label={t('recommendation.labels.entry')} value={formatCurrency(suggestedEntry, currency)} emphasize />
                <MetricTile label={t('recommendation.labels.stop')} value={formatCurrency(suggestedStop, currency)} />
                <MetricTile
                  label={t('recommendation.labels.target')}
                  value={
                    recRisk?.target != null ? formatCurrency(recRisk.target, currency) : t('common.placeholders.emDash')
                  }
                />
                <MetricTile
                  label={t('order.candidateModal.labels.rr')}
                  value={
                    contextRReward != null
                      ? formatNumber(contextRReward, 1)
                      : recRisk?.rr != null
                        ? formatNumber(recRisk.rr, 1)
                        : t('common.placeholders.emDash')
                  }
                />
                <MetricTile
                  label={t('recommendation.labels.shares')}
                  value={String(recRisk?.shares ?? contextShares ?? suggestedShares)}
                />
                <MetricTile
                    label={t('tradeThesis.setupType')}
                  value={thesis?.explanation.setupType ?? t(guidance.setupLabelKey)}
                />
                <MetricTile
                  label={t('tradeThesis.tradeSafety')}
                  value={
                    thesis?.safetyLabel
                      ? t(`tradeThesis.safetyLabel.${thesis.safetyLabel}`)
                      : t('common.placeholders.emDash')
                  }
                />
              </div>

              {warnings.length ? (
                <div className="space-y-2">
                  {warnings.map((warning) => (
                    <div
                      key={warning}
                      className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning"
                    >
                      {warning}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div
            id="order-review-panel-setup"
            role="tabpanel"
            aria-labelledby="order-review-tab-setup"
            hidden={activeSection !== 'setup'}
            className="p-4"
          >
            {thesis ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MetricTile
                    label={t('tradeThesis.setupQuality')}
                    value={`${thesis.setupQualityScore}/100`}
                    emphasize
                  />
                  <MetricTile
                    label={t('tradeThesis.fields.setupQualityTier')}
                    value={t(`tradeThesis.setupQualityTier.${thesis.setupQualityTier}`)}
                  />
                  <MetricTile
                    label={t('tradeThesis.fields.trendStatus')}
                    value={thesis.trendStatus}
                  />
                  <MetricTile
                    label={t('tradeThesis.fields.relativeStrength')}
                    value={thesis.relativeStrength}
                  />
                </div>

                <div className="rounded-lg border border-primary/40 bg-primary/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {thesisEducation?.title || t('tradeThesis.keyInsight')}
                  </p>
                  <p className="mt-2 text-sm text-primary">
                    {thesisEducation?.summary || thesis.explanation.keyInsight}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-foreground">{t('tradeThesis.whyQualified')}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                    {(thesisEducation?.bullets.length ? thesisEducation.bullets : thesis.explanation.whyQualified).map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <EmptySection body={t('workspacePage.panels.analysis.noThesis')} />
            )}
          </div>

          <div
            id="order-review-panel-risk"
            role="tabpanel"
            aria-labelledby="order-review-tab-risk"
            hidden={activeSection !== 'risk'}
            className="p-4"
          >
            <div className="space-y-4">
              {hardInvalidations.length ? (
                <div>
                  <p className="text-sm font-semibold text-foreground">{t('order.review.hardInvalidationTitle' as any)}</p>
                  <ul className="mt-2 space-y-2">
                    {hardInvalidations.map((rule) => (
                      <li
                        key={rule.ruleId}
                        className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
                      >
                        <p>{rule.condition}</p>
                        {rule.metric && rule.threshold != null ? (
                          <p className="mt-1 text-xs text-danger">
                            {t('tradeThesis.monitor')}: {rule.metric} {t('tradeThesis.thresholdAt')} {rule.threshold}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {(softInvalidations.length || recommendation?.thesis?.explanation.whatCouldGoWrong.length) ? (
                <div>
                  <p className="text-sm font-semibold text-foreground">{t('order.review.softWarningsTitle' as any)}</p>
                  <ul className="mt-2 space-y-2">
                    {softInvalidations.map((rule) => (
                      <li
                        key={rule.ruleId}
                        className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning"
                      >
                        <p>{rule.condition}</p>
                        {rule.metric && rule.threshold != null ? (
                          <p className="mt-1 text-xs text-warning">
                            {t('tradeThesis.monitor')}: {rule.metric} {t('tradeThesis.thresholdAt')} {rule.threshold}
                          </p>
                        ) : null}
                      </li>
                    ))}
                    {(
                      thesisEducation?.watchouts.length ? thesisEducation.watchouts : recommendation?.thesis?.explanation.whatCouldGoWrong ?? []
                    ).map((riskItem) => (
                      <li
                        key={riskItem}
                        className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning"
                      >
                        {riskItem}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {!recommendation?.thesis?.explanation.whatCouldGoWrong.length &&
              !invalidationRules.length ? (
                <EmptySection body={t('order.review.riskFallback')} />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
