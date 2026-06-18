import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { AlertTriangle } from 'lucide-react';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Textarea from '@/components/common/Textarea';
import EarningsWarningBanner from '@/components/domain/screener/EarningsWarningBanner';
import OrderReviewSummary from '@/components/domain/orders/OrderReviewSummary';
import OrderExecutionGuidePanel from '@/components/domain/orders/OrderExecutionGuidePanel';
import {
  CONCENTRATION_WARNING_THRESHOLD,
  classifyInvalidationRule,
  countryFromTicker,
  type ReviewSectionId,
} from '@/components/domain/orders/orderReviewHelpers';

import { useOrderRiskMetrics } from '@/components/domain/orders/useOrderRiskMetrics';
import { candidateOrderSchema, type CandidateOrderFormValues } from '@/components/domain/orders/schemas';
import { getSetupExecutionGuidance, normalizeSetupSignal } from '@/features/orders/setupGuidance';
import { normalizeSuggestedOrderType, resolveDefaultOrderType } from '@/features/orders/executionDefaults';
import { usePortfolioSummary } from '@/features/portfolio/hooks';
import type { CreateOrderRequest } from '@/features/portfolio/types';
import type { SameSymbolCandidateContext } from '@/features/screener/types';
import type { RiskConfig } from '@/types/config';
import type { Recommendation } from '@/types/recommendation';
import { t } from '@/i18n/t';
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
  avgDailyVolumeEur?: number | null;
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
  const recTarget = recRisk?.target ?? null;
  const suggestedTarget =
    recTarget != null && Number.isFinite(recTarget) && recTarget > suggestedEntry
      ? parseFloat(recTarget.toFixed(2))
      : undefined;
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
      targetPrice: suggestedTarget,
      notes: defaultNotes,
    },
  });

  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSucceeded, setSubmitSucceeded] = useState(false);
  const [activeSection, setActiveSection] = useState<ReviewSectionId>('decision');
  const [tradeThesis, setTradeThesis] = useState('');
  const portfolioSummaryQuery = usePortfolioSummary();

  useEffect(() => {
    form.reset({
      orderType: defaultOrderType,
      quantity: suggestedShares,
      limitPrice: parseFloat(suggestedEntry.toFixed(2)),
      stopPrice: parseFloat(suggestedStop.toFixed(2)),
      targetPrice: suggestedTarget,
      notes: defaultNotes,
    });
    setOverrideConfirmed(false);
    setSubmissionError(null);
    setSubmitSucceeded(false);
    setIsSubmitting(false);
    setActiveSection('decision');
    setTradeThesis('');
  }, [defaultNotes, defaultOrderType, form, suggestedEntry, suggestedShares, suggestedStop, suggestedTarget, normalizedTicker]);

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

  const projectedConcentration = useMemo(() => {
    const summary = portfolioSummaryQuery.data;
    if (!summary || riskAmount <= 0) return null;
    const country = countryFromTicker(normalizedTicker);
    const currentGroup = summary.concentration.find((group) => group.country === country);
    const currentRisk = currentGroup?.riskAmount ?? 0;
    const projectedOpenRisk = summary.openRisk + riskAmount;
    if (projectedOpenRisk <= 0) return null;
    const projectedRiskPct = ((currentRisk + riskAmount) / projectedOpenRisk) * 100;
    if (projectedRiskPct < CONCENTRATION_WARNING_THRESHOLD) return null;
    return {
      country,
      currentRiskPct: currentGroup?.riskPct ?? 0,
      projectedRiskPct,
    };
  }, [normalizedTicker, portfolioSummaryQuery.data, riskAmount]);

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
    const adv = context.avgDailyVolumeEur;
    if (adv != null && adv > 0 && quantity > 0 && limitPrice > 0) {
      const notional = quantity * limitPrice;
      const pct = (notional / adv) * 100;
      if (pct > 5) {
        nextWarnings.push(
          t('order.candidateModal.liquiditySlippageWarning', { pct: pct.toFixed(1) }),
        );
      }
    }
    return nextWarnings;
  }, [enforceRecommendation, hasOrderTypeMismatch, hasSkipSuggestion, normalizedSuggestedOrderType, verdict,
      context.avgDailyVolumeEur, quantity, limitPrice]);
  const invalidationRules = context.recommendation?.thesis?.invalidationRules ?? [];
  const hardInvalidations = invalidationRules.filter((rule) => classifyInvalidationRule(rule.condition) === 'hard');
  const softInvalidations = invalidationRules.filter((rule) => classifyInvalidationRule(rule.condition) === 'soft');

  const fieldIds = useMemo(
    () => ({
      orderType: `order-review-order-type-${normalizedTicker}`,
      quantity: `order-review-quantity-${normalizedTicker}`,
      limitPrice: `order-review-limit-price-${normalizedTicker}`,
      stopPrice: `order-review-stop-price-${normalizedTicker}`,
      targetPrice: `order-review-target-price-${normalizedTicker}`,
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
        targetPrice: values.targetPrice,
        orderKind: 'entry',
        positionId: (context.sameSymbol?.mode === 'ADD_ON' || context.sameSymbol?.mode === 'SCALE_BACK') ? (context.positionId ?? context.sameSymbol.positionId) : undefined,
        entryMode: context.sameSymbol?.mode === 'ADD_ON' || context.sameSymbol?.mode === 'SCALE_BACK' ? 'ADD_ON' : 'NEW_ENTRY',
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
      <EarningsWarningBanner ticker={normalizedTicker} />
      {projectedConcentration ? (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <span>
            {t('concentrationWarning.orderMessage', {
              country: projectedConcentration.country,
              currentPct: formatNumber(projectedConcentration.currentRiskPct, 0),
              projectedPct: formatNumber(projectedConcentration.projectedRiskPct, 0),
            })}
          </span>
        </div>
      ) : null}

      <OrderReviewSummary
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        recommendation={context.recommendation}
        verdict={verdict}
        reasonsDetailed={reasonsDetailed}
        isRecommended={isRecommended}
        isIncomplete={isIncomplete}
        showManualOrderHint={showManualOrderHint}
        knownCurrentPrice={knownCurrentPrice}
        currency={currency}
        suggestedEntry={suggestedEntry}
        suggestedStop={suggestedStop}
        suggestedShares={suggestedShares}
        recRisk={recRisk}
        contextShares={context.shares}
        contextRReward={context.rReward}
        thesis={thesis}
        thesisEducation={thesisEducation}
        guidance={guidance}
        warnings={warnings}
        invalidationRules={invalidationRules}
        hardInvalidations={hardInvalidations}
        softInvalidations={softInvalidations}
      />

      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-foreground">{t('order.review.formTitle')}</h3>
          <p className="text-sm text-muted">{t('order.review.formDescription')}</p>
        </div>

        {showManualOrderHint ? (
          <div className="mb-4 rounded border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
            {t('workspacePage.panels.analysis.manualOrderHint')}
          </div>
        ) : null}

        {warnings.length ? (
          <div className="mb-4 space-y-2">
            {warnings.map((warning) => (
              <div
                key={`form-${warning}`}
                className="rounded border border-warning/40 bg-warning/10 p-3 text-sm text-warning"
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
                  <Select
                    id={fieldIds.orderType}
                    {...form.register('orderType')}
                  >
                    <option value="BUY_LIMIT">{t('order.candidateModal.orderTypeOptions.buyLimit')}</option>
                    <option value="BUY_STOP">{t('order.candidateModal.orderTypeOptions.buyStop')}</option>
                    <option value="BUY_MARKET">{t('order.candidateModal.orderTypeOptions.buyMarket')}</option>
                  </Select>
                </div>

                <div>
                  <label htmlFor={fieldIds.quantity} className="mb-1 block text-xs font-medium">
                    {t('order.candidateModal.quantity')}
                  </label>
                  <Input
                    id={fieldIds.quantity}
                    type="number"
                    min="1"
                    {...form.register('quantity', { valueAsNumber: true })}
                  />
                  {form.formState.errors.quantity ? (
                    <p className="mt-1 text-xs text-danger">{form.formState.errors.quantity.message}</p>
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
                  <Input
                    id={fieldIds.limitPrice}
                    type="number"
                    step="0.01"
                    min="0.01"
                    {...form.register('limitPrice', { valueAsNumber: true })}
                  />
                  {orderType === 'BUY_STOP' ? (
                    <p className="mt-1 text-xs text-muted">{t('order.candidateModal.buyStopHint')}</p>
                  ) : null}
                  {form.formState.errors.limitPrice ? (
                    <p className="mt-1 text-xs text-danger">{form.formState.errors.limitPrice.message}</p>
                  ) : null}
                  {invalidBuyStopPrice ? (
                    <p className="mt-1 text-xs text-danger">
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
                  <Input
                    id={fieldIds.stopPrice}
                    type="number"
                    step="0.01"
                    min="0.01"
                    {...form.register('stopPrice', { valueAsNumber: true })}
                  />
                  {form.formState.errors.stopPrice ? (
                    <p className="mt-1 text-xs text-danger">{form.formState.errors.stopPrice.message}</p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor={fieldIds.targetPrice} className="mb-1 block text-xs font-medium">
                    {t('order.candidateModal.targetPrice')}
                  </label>
                  <Input
                    id={fieldIds.targetPrice}
                    type="number"
                    step="0.01"
                    min="0.01"
                    {...form.register('targetPrice', {
                      setValueAs: (v) => (v === '' || v == null ? undefined : Number(v)),
                    })}
                  />
                  {form.formState.errors.targetPrice ? (
                    <p className="mt-1 text-xs text-danger">{form.formState.errors.targetPrice.message}</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-md bg-foreground/5 p-3 text-xs">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
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
                    <strong className={riskPercent > risk.riskPct * 100 ? 'text-danger' : 'text-success'}>
                      {riskPercent.toFixed(2)}%
                    </strong>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor={fieldIds.notes} className="mb-1 block text-xs font-medium">
                  {t('order.candidateModal.notes')}
                </label>
                <Textarea
                  id={fieldIds.notes}
                  rows={3}
                  {...form.register('notes')}
                />
              </div>

              <div>
                <label htmlFor={`order-review-thesis-${normalizedTicker}`} className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t('order.candidateModal.tradeThesis')}
                </label>
                <Textarea
                  id={`order-review-thesis-${normalizedTicker}`}
                  rows={3}
                  value={tradeThesis}
                  onChange={(e) => setTradeThesis(e.target.value)}
                  placeholder={t('order.candidateModal.tradeThesisPlaceholder')}
                />
              </div>

              {needsOverrideConfirmation ? (
                <label className="flex items-start gap-2 rounded border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
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
                <div className="rounded border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
                  {submissionError}
                </div>
              ) : null}

              <div className="sticky bottom-0 z-10 -mx-1 rounded-xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-surface/90">
                {submitSucceeded ? (
                  <div className="mb-3 rounded border border-success/40 bg-success/10 p-2 text-xs text-success">
                    {successMessage}
                  </div>
                ) : null}
                <div className="flex justify-end">
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

            <OrderExecutionGuidePanel
              guidance={guidance}
              guidanceSignal={guidanceSignal}
              executionNote={context.executionNote}
              orderType={orderType}
              entryPrice={limitPrice}
              stopPrice={stopPrice}
              quantity={quantity}
              currency={currency}
            />
          </div>
        </form>
      </section>
    </div>
  );
}
