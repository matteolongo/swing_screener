import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import Button from '@/components/common/Button';
import RecommendationBadge from '@/components/domain/recommendation/RecommendationBadge';
import SetupExecutionGuide from '@/components/domain/orders/SetupExecutionGuide';
import DegiroOrderConfigGuide from '@/components/domain/orders/DegiroOrderConfigGuide';
import { useOrderRiskMetrics } from '@/components/domain/orders/useOrderRiskMetrics';
import { candidateOrderSchema, type CandidateOrderFormValues } from '@/components/domain/orders/schemas';
import { getSetupExecutionGuidance, normalizeSetupSignal } from '@/features/orders/setupGuidance';
import { normalizeSuggestedOrderType, resolveDefaultOrderType } from '@/features/orders/executionDefaults';
import type { CreateOrderRequest } from '@/features/portfolio/types';
import type { SameSymbolCandidateContext } from '@/features/screener/types';
import type { RiskConfig } from '@/types/config';
import type { Recommendation } from '@/types/recommendation';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import { formatCurrency, formatNumber } from '@/utils/formatters';

export interface OrderReviewContext {
  ticker: string;
  signal?: string;
  entry?: number;
  stop?: number;
  close?: number;
  shares?: number;
  recommendation?: Recommendation;
  sector?: string | null;
  rReward?: number;
  score?: number;
  rank?: number;
  atr?: number;
  currency?: string;
  suggestedOrderType?: string | null;
  suggestedOrderPrice?: number | null;
  executionNote?: string | null;
  positionId?: string | null;
  sameSymbol?: SameSymbolCandidateContext;
}

interface OrderReviewExperienceProps {
  context: OrderReviewContext;
  risk: RiskConfig;
  defaultNotes: string;
  onSubmitOrder: (request: CreateOrderRequest) => Promise<unknown>;
  onSuccess?: () => void;
  enforceRecommendation?: boolean;
  showManualOrderHint?: boolean;
  successMessage?: string;
}

type ReviewSectionId = 'decision' | 'setup' | 'risk';

const REVIEW_SECTIONS: Array<{ id: ReviewSectionId; titleKey: string }> = [
  { id: 'decision', titleKey: 'order.review.sections.decision' },
  { id: 'setup', titleKey: 'order.review.sections.setup' },
  { id: 'risk', titleKey: 'order.review.sections.risk' },
];

function MetricTile({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className={cn('mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100', emphasize && 'text-blue-700 dark:text-blue-300')}>
        {value}
      </p>
    </div>
  );
}

function EmptySection({ body }: { body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
      {body}
    </div>
  );
}

function classifyInvalidationRule(condition: string) {
  const normalized = condition.toLowerCase();
  if (
    normalized.includes('stop') ||
    normalized.includes('close') ||
    normalized.includes('breaks below') ||
    normalized.includes('invalid')
  ) {
    return 'hard';
  }
  return 'soft';
}

export default function OrderReviewExperience({
  context,
  risk,
  defaultNotes,
  onSubmitOrder,
  onSuccess,
  enforceRecommendation = false,
  showManualOrderHint = false,
  successMessage = t('workspacePage.panels.analysis.createOrderSuccess'),
}: OrderReviewExperienceProps) {
  const normalizedTicker = context.ticker.trim().toUpperCase();
  const recRisk = context.recommendation?.risk;
  const defaultOrderType = resolveDefaultOrderType(context.signal, context.suggestedOrderType);
  const normalizedSignal = normalizeSetupSignal(context.signal);
  const normalizedSuggestedOrderType = normalizeSuggestedOrderType(context.suggestedOrderType);
  const hasSuggestedOrderType = normalizedSuggestedOrderType === 'BUY_LIMIT' || normalizedSuggestedOrderType === 'BUY_STOP';
  const hasSkipSuggestion = normalizedSuggestedOrderType === 'SKIP';
  const guidanceSignal =
    normalizedSignal === 'breakout' && normalizedSuggestedOrderType === 'BUY_LIMIT'
      ? 'pullback'
      : context.signal;
  const guidance = getSetupExecutionGuidance(guidanceSignal);
  const thesis = context.recommendation?.thesis;
  const thesisEducation = thesis?.educationGenerated?.thesis;
  const fallbackEntry = 100;
  const preferredEntry = context.suggestedOrderPrice ?? recRisk?.entry;
  const initialEntry = preferredEntry ?? context.entry ?? context.close ?? fallbackEntry;
  const suggestedEntry = Number.isFinite(initialEntry) && initialEntry > 0 ? initialEntry : fallbackEntry;
  const initialStop = recRisk?.stop ?? context.stop ?? suggestedEntry * 0.95;
  const suggestedStop = Math.max(0.01, Math.min(initialStop, suggestedEntry - 0.01));
  const rawSuggestedShares = recRisk?.shares ?? context.shares ?? Math.max(1, risk.minShares);
  const maxSharesByPositionCap =
    risk.maxPositionPct > 0 && suggestedEntry > 0
      ? Math.floor((risk.accountSize * risk.maxPositionPct) / suggestedEntry)
      : rawSuggestedShares;
  const suggestedShares = Math.max(1, Math.min(rawSuggestedShares, maxSharesByPositionCap));
  const verdict = context.recommendation?.verdict ?? 'UNKNOWN';
  const isRecommended = verdict === 'RECOMMENDED';
  const reasonsDetailed = context.recommendation?.reasonsDetailed;
  const COMPLETENESS_CODES = new Set(['STOP_MISSING', 'NO_SIGNAL']);
  const isIncomplete =
    verdict === 'NOT_RECOMMENDED' &&
    !!reasonsDetailed?.length &&
    reasonsDetailed.filter((r) => r.severity === 'block').every((r) => COMPLETENESS_CODES.has(r.code));
  const currency = context.currency ?? 'USD';
  const knownCurrentPrice =
    typeof context.close === 'number' && Number.isFinite(context.close) && context.close > 0 ? context.close : null;

  const form = useForm<CandidateOrderFormValues>({
    resolver: zodResolver(candidateOrderSchema),
    defaultValues: {
      orderType: defaultOrderType,
      quantity: suggestedShares,
      limitPrice: parseFloat(suggestedEntry.toFixed(2)),
      stopPrice: parseFloat(suggestedStop.toFixed(2)),
      notes: defaultNotes,
    },
  });

  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSucceeded, setSubmitSucceeded] = useState(false);
  const [activeSection, setActiveSection] = useState<ReviewSectionId>('decision');
  const [tradeThesis, setTradeThesis] = useState('');

  useEffect(() => {
    form.reset({
      orderType: defaultOrderType,
      quantity: suggestedShares,
      limitPrice: parseFloat(suggestedEntry.toFixed(2)),
      stopPrice: parseFloat(suggestedStop.toFixed(2)),
      notes: defaultNotes,
    });
    setOverrideConfirmed(false);
    setSubmissionError(null);
    setSubmitSucceeded(false);
    setIsSubmitting(false);
    setActiveSection('decision');
    setTradeThesis('');
  }, [defaultNotes, defaultOrderType, form, suggestedEntry, suggestedShares, suggestedStop, normalizedTicker]);

  const orderType = form.watch('orderType') ?? defaultOrderType;
  const quantity = form.watch('quantity') ?? 0;
  const limitPrice = form.watch('limitPrice') ?? 0;
  const stopPrice = form.watch('stopPrice') ?? 0;
  const hasOrderTypeMismatch = hasSuggestedOrderType && orderType !== normalizedSuggestedOrderType;
  const needsOverrideConfirmation = hasOrderTypeMismatch || (hasSkipSuggestion && !isRecommended);
  const invalidBuyStopPrice = orderType === 'BUY_STOP' && knownCurrentPrice != null && limitPrice <= knownCurrentPrice;
  const triggerPriceLabel =
    orderType === 'BUY_STOP' ? t('order.candidateModal.triggerPrice') : t('order.candidateModal.limitPrice');

  const { positionSize, riskAmount, accountPercent, riskPercent } = useOrderRiskMetrics({
    limitPrice,
    stopPrice,
    quantity,
    accountSize: risk.accountSize,
  });

  const warnings = useMemo(() => {
    const nextWarnings: string[] = [];
    if (enforceRecommendation && verdict === 'NOT_RECOMMENDED') {
      nextWarnings.push(t('order.candidateModal.notRecommended'));
    }
    if (hasSkipSuggestion) {
      nextWarnings.push(t('order.candidateModal.skipSuggestedBody'));
    }
    if (hasOrderTypeMismatch) {
      nextWarnings.push(
        t('order.candidateModal.orderTypeMismatchWarning', {
          suggestedType: normalizedSuggestedOrderType,
        }),
      );
    }
    return nextWarnings;
  }, [enforceRecommendation, hasOrderTypeMismatch, hasSkipSuggestion, normalizedSuggestedOrderType, verdict]);
  const invalidationRules = context.recommendation?.thesis?.invalidationRules ?? [];
  const hardInvalidations = invalidationRules.filter((rule) => classifyInvalidationRule(rule.condition) === 'hard');
  const softInvalidations = invalidationRules.filter((rule) => classifyInvalidationRule(rule.condition) === 'soft');

  const fieldIds = useMemo(
    () => ({
      orderType: `order-review-order-type-${normalizedTicker}`,
      quantity: `order-review-quantity-${normalizedTicker}`,
      limitPrice: `order-review-limit-price-${normalizedTicker}`,
      stopPrice: `order-review-stop-price-${normalizedTicker}`,
      notes: `order-review-notes-${normalizedTicker}`,
    }),
    [normalizedTicker],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmissionError(null);
    setSubmitSucceeded(false);

    if (enforceRecommendation && !isRecommended) {
      setSubmissionError(t('order.candidateModal.notRecommended'));
      return;
    }

    if (invalidBuyStopPrice) {
      setSubmissionError(
        t('order.candidateModal.buyStopAboveMarketError', {
          currentPrice:
            knownCurrentPrice != null ? formatCurrency(knownCurrentPrice, currency) : t('common.placeholders.emDash'),
        }),
      );
      return;
    }

    if (needsOverrideConfirmation && !overrideConfirmed) {
      setSubmissionError(t('order.candidateModal.overrideRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitOrder({
        ticker: normalizedTicker,
        orderType: values.orderType,
        quantity: values.quantity,
        limitPrice: values.limitPrice,
        stopPrice: values.stopPrice,
        orderKind: 'entry',
        positionId: context.sameSymbol?.mode === 'ADD_ON' ? (context.positionId ?? context.sameSymbol.positionId) : undefined,
        entryMode: context.sameSymbol?.mode === 'ADD_ON' ? 'ADD_ON' : 'NEW_ENTRY',
        notes: values.notes?.trim() ?? '',
        thesis: tradeThesis.trim() || undefined,
      });
      setSubmitSucceeded(true);
      onSuccess?.();
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : t('order.candidateModal.createError'));
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <div className="space-y-4">
      <section
        className="rounded-lg border border-gray-200 bg-slate-50/70 p-3 dark:border-gray-700 dark:bg-gray-900/50"
        aria-label={t('order.review.carouselLabel')}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t('order.review.kicker')}
              </p>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {t('order.review.title' as any)}
              </h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {t('order.review.subtitle' as any)}
              </p>
            </div>
          </div>

          <div
            className="flex w-full items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-950"
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
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-gray-900 text-white shadow-sm dark:bg-white dark:text-gray-900'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white',
                  )}
                >
                  {t(section.titleKey as any)}
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-950">
            <div
              id="order-review-panel-decision"
              role="tabpanel"
              aria-labelledby="order-review-tab-decision"
              hidden={activeSection !== 'decision'}
              className="p-4"
            >
              <div className="space-y-4">
                {context.recommendation ? (
                  <div className={cn(
                    'rounded-xl border p-4',
                    isRecommended
                      ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20'
                      : isIncomplete
                        ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20'
                        : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20',
                  )}>
                    <div className="flex flex-wrap items-center gap-2">
                      <RecommendationBadge verdict={verdict} reasonsDetailed={reasonsDetailed} />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{t('recommendation.summary')}</span>
                    </div>
                    {context.recommendation.reasonsShort.length ? (
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
                        {context.recommendation.reasonsShort.map((reason) => (
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
                      context.rReward != null
                        ? formatNumber(context.rReward, 1)
                        : recRisk?.rr != null
                          ? formatNumber(recRisk.rr, 1)
                          : t('common.placeholders.emDash')
                    }
                  />
                  <MetricTile
                    label={t('recommendation.labels.shares')}
                    value={String(recRisk?.shares ?? context.shares ?? suggestedShares)}
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
                        className="rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-900 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200"
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

                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                      {thesisEducation?.title || t('tradeThesis.keyInsight')}
                    </p>
                    <p className="mt-2 text-sm text-blue-950 dark:text-blue-100">
                      {thesisEducation?.summary || thesis.explanation.keyInsight}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('tradeThesis.whyQualified')}</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
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
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('order.review.hardInvalidationTitle' as any)}</p>
                    <ul className="mt-2 space-y-2">
                      {hardInvalidations.map((rule) => (
                        <li
                          key={rule.ruleId}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/20 dark:text-red-100"
                        >
                          <p>{rule.condition}</p>
                          {rule.metric && rule.threshold != null ? (
                            <p className="mt-1 text-xs text-red-800 dark:text-red-300">
                              {t('tradeThesis.monitor')}: {rule.metric} {t('tradeThesis.thresholdAt')} {rule.threshold}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {(softInvalidations.length || context.recommendation?.thesis?.explanation.whatCouldGoWrong.length) ? (
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('order.review.softWarningsTitle' as any)}</p>
                    <ul className="mt-2 space-y-2">
                      {softInvalidations.map((rule) => (
                        <li
                          key={rule.ruleId}
                          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100"
                        >
                          <p>{rule.condition}</p>
                          {rule.metric && rule.threshold != null ? (
                            <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                              {t('tradeThesis.monitor')}: {rule.metric} {t('tradeThesis.thresholdAt')} {rule.threshold}
                            </p>
                          ) : null}
                        </li>
                      ))}
                      {(
                        thesisEducation?.watchouts.length ? thesisEducation.watchouts : context.recommendation?.thesis?.explanation.whatCouldGoWrong ?? []
                      ).map((riskItem) => (
                        <li
                          key={riskItem}
                          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100"
                        >
                          {riskItem}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    {t('order.review.executionCautionTitle' as any)}
                  </p>
                  <p className="mt-2 text-sm text-amber-950 dark:text-amber-100">
                    {context.recommendation?.education.commonBiasWarning || t(guidance.cautionKey)}
                  </p>
                  {context.recommendation?.education.whatWouldMakeValid.length ? (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900 dark:text-amber-100">
                      {context.recommendation.education.whatWouldMakeValid.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                {!context.recommendation?.thesis?.explanation.whatCouldGoWrong.length &&
                !invalidationRules.length ? (
                  <EmptySection body={t('order.review.riskFallback')} />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-950">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('order.review.formTitle')}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('order.review.formDescription')}</p>
        </div>

        {showManualOrderHint ? (
          <div className="mb-4 rounded border border-blue-300 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
            {t('workspacePage.panels.analysis.manualOrderHint')}
          </div>
        ) : null}

        {warnings.length ? (
          <div className="mb-4 space-y-2">
            {warnings.map((warning) => (
              <div
                key={`form-${warning}`}
                className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200"
              >
                {warning}
              </div>
            ))}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label htmlFor={fieldIds.orderType} className="mb-1 block text-xs font-medium">
                    {t('order.candidateModal.orderType')}
                  </label>
                  <select
                    id={fieldIds.orderType}
                    {...form.register('orderType')}
                    className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                  >
                    <option value="BUY_LIMIT">{t('order.candidateModal.orderTypeOptions.buyLimit')}</option>
                    <option value="BUY_STOP">{t('order.candidateModal.orderTypeOptions.buyStop')}</option>
                    <option value="BUY_MARKET">{t('order.candidateModal.orderTypeOptions.buyMarket')}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor={fieldIds.quantity} className="mb-1 block text-xs font-medium">
                    {t('order.candidateModal.quantity')}
                  </label>
                  <input
                    id={fieldIds.quantity}
                    type="number"
                    min="1"
                    {...form.register('quantity', { valueAsNumber: true })}
                    className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                  />
                  {form.formState.errors.quantity ? (
                    <p className="mt-1 text-xs text-red-600">{form.formState.errors.quantity.message}</p>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label
                    htmlFor={fieldIds.limitPrice}
                    className="mb-1 block text-xs font-medium"
                    title={orderType === 'BUY_STOP' ? t('order.candidateModal.buyStopTerminologyTooltip') : undefined}
                  >
                    {triggerPriceLabel}
                  </label>
                  <input
                    id={fieldIds.limitPrice}
                    type="number"
                    step="0.01"
                    min="0.01"
                    {...form.register('limitPrice', { valueAsNumber: true })}
                    className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                  />
                  {orderType === 'BUY_STOP' ? (
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{t('order.candidateModal.buyStopHint')}</p>
                  ) : null}
                  {form.formState.errors.limitPrice ? (
                    <p className="mt-1 text-xs text-red-600">{form.formState.errors.limitPrice.message}</p>
                  ) : null}
                  {invalidBuyStopPrice ? (
                    <p className="mt-1 text-xs text-red-600">
                      {t('order.candidateModal.buyStopAboveMarketError', {
                        currentPrice:
                          knownCurrentPrice != null
                            ? formatCurrency(knownCurrentPrice, currency)
                            : t('common.placeholders.emDash'),
                      })}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor={fieldIds.stopPrice} className="mb-1 block text-xs font-medium">
                    {t('order.candidateModal.stopPrice')}
                  </label>
                  <input
                    id={fieldIds.stopPrice}
                    type="number"
                    step="0.01"
                    min="0.01"
                    {...form.register('stopPrice', { valueAsNumber: true })}
                    className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                  />
                  {form.formState.errors.stopPrice ? (
                    <p className="mt-1 text-xs text-red-600">{form.formState.errors.stopPrice.message}</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-md bg-gray-50 p-3 text-xs dark:bg-gray-800">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {t('order.candidateModal.positionSummary')}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex justify-between gap-3">
                    <span>{t('order.candidateModal.positionSize')}</span>
                    <strong>{formatCurrency(positionSize, currency)}</strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>{t('order.candidateModal.accountPercent')}</span>
                    <strong>{accountPercent.toFixed(1)}%</strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>{t('order.candidateModal.riskAmount')}</span>
                    <strong>{formatCurrency(riskAmount, currency)}</strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>{t('order.candidateModal.riskPercent')}</span>
                    <strong className={riskPercent > risk.riskPct * 100 ? 'text-red-600' : 'text-green-600'}>
                      {riskPercent.toFixed(2)}%
                    </strong>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor={fieldIds.notes} className="mb-1 block text-xs font-medium">
                  {t('order.candidateModal.notes')}
                </label>
                <textarea
                  id={fieldIds.notes}
                  rows={3}
                  {...form.register('notes')}
                  className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                />
              </div>

              <div>
                <label htmlFor={`order-review-thesis-${normalizedTicker}`} className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t('order.candidateModal.tradeThesis')}
                </label>
                <textarea
                  id={`order-review-thesis-${normalizedTicker}`}
                  rows={3}
                  value={tradeThesis}
                  onChange={(e) => setTradeThesis(e.target.value)}
                  placeholder={t('order.candidateModal.tradeThesisPlaceholder')}
                  className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                />
              </div>

              {needsOverrideConfirmation ? (
                <label className="flex items-start gap-2 rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-900 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
                  <input
                    type="checkbox"
                    checked={overrideConfirmed}
                    onChange={(event) => setOverrideConfirmed(event.target.checked)}
                    className="mt-0.5"
                  />
                  <span>{t('order.candidateModal.overrideConfirm')}</span>
                </label>
              ) : null}

              {submissionError ? (
                <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                  {submissionError}
                </div>
              ) : null}

              {submitSucceeded ? (
                <div className="rounded border border-green-300 bg-green-50 p-2 text-xs text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
                  {successMessage}
                </div>
              ) : null}

              <div className="sticky bottom-0 z-10 -mx-1 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/90">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="grid grid-cols-3 gap-2 text-xs text-slate-600">
                    <div>
                      <div className="uppercase tracking-wide text-slate-500">{t('order.review.summaryPosition' as any)}</div>
                      <div className="mt-1 font-semibold text-slate-900">{formatCurrency(positionSize, currency)}</div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wide text-slate-500">{t('order.review.summaryRisk' as any)}</div>
                      <div className="mt-1 font-semibold text-slate-900">{formatCurrency(riskAmount, currency)}</div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wide text-slate-500">{t('order.review.summaryRiskPct' as any)}</div>
                      <div className={`mt-1 font-semibold ${riskPercent > risk.riskPct * 100 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {riskPercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      invalidBuyStopPrice ||
                      (needsOverrideConfirmation && !overrideConfirmed) ||
                      (enforceRecommendation && !isRecommended)
                    }
                    className="w-full sm:w-auto"
                  >
                    {isSubmitting ? t('order.candidateModal.creating') : t('order.candidateModal.createAction')}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                  {t('order.review.executionGuideTitle' as any)}
                </p>
                <div className="mt-2 space-y-2">
                  <p>
                    <span className="font-semibold">{t('order.setupGuidance.setupLabel')}</span> {t(guidance.setupLabelKey)}
                  </p>
                  <p>{t(guidance.whatItMeansKey)}</p>
                  {context.executionNote ? (
                    <div className="rounded-md border border-blue-200 bg-white/70 px-3 py-2 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-100">
                      {context.executionNote}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">{t('order.review.executionCautionTitle' as any)}</p>
                <p className="mt-2">{t(guidance.cautionKey)}</p>
              </div>

              <details className="rounded-lg border border-slate-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-950">
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 dark:text-gray-100">
                  {t('order.review.brokerStepsTitle' as any)}
                </summary>
                <div className="mt-3">
                  <SetupExecutionGuide signal={guidanceSignal} />
                </div>
              </details>

              <details className="rounded-lg border border-slate-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-950">
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 dark:text-gray-100">
                  {t('order.review.degiroSetupTitle' as any)}
                </summary>
                <div className="mt-3">
                  <DegiroOrderConfigGuide
                    orderType={orderType}
                    entryPrice={limitPrice}
                    stopPrice={stopPrice}
                    quantity={quantity}
                    currency={currency}
                  />
                </div>
              </details>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
