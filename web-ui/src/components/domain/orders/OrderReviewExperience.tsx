import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Textarea from '@/components/common/Textarea';
import EarningsWarningBanner from '@/components/domain/screener/EarningsWarningBanner';
import OrderReviewSummary from '@/components/domain/orders/OrderReviewSummary';
import OrderExecutionGuidePanel from '@/components/domain/orders/OrderExecutionGuidePanel';
import {
  classifyInvalidationRule,
  type ReviewSectionId,
} from '@/components/domain/orders/orderReviewHelpers';

import { candidateOrderSchema, type CandidateOrderFormValues } from '@/components/domain/orders/schemas';
import { getSetupExecutionGuidance } from '@/features/orders/setupGuidance';
import type { CreateOrderRequest } from '@/features/portfolio/types';
import type { CanonicalOrderDraft, SameSymbolCandidateContext } from '@/features/screener/types';
import type { Recommendation } from '@/types/recommendation';
import { t } from '@/i18n/t';
import { getWorkflowPresentation } from '@/components/domain/recommendation/workflowPresentation';

export interface OrderReviewContext {
  ticker: string;
  signal?: string;
  close?: number;
  recommendation?: Recommendation;
  sector?: string | null;
  executionNote?: string | null;
  positionId?: string | null;
  sameSymbol?: SameSymbolCandidateContext;
  dataStatus?: 'current' | 'stale' | 'intraday' | 'unknown';
  dataAsOf?: string;
  daysToEarnings?: number | null;
  strategyId?: string;
  canonicalOrderDraft: CanonicalOrderDraft;
}

interface OrderReviewExperienceProps {
  context: OrderReviewContext;
  defaultNotes: string;
  onSubmitOrder: (request: CreateOrderRequest) => Promise<unknown>;
  onSuccess?: () => void;
  showManualOrderHint?: boolean;
  successMessage?: string;
}

export default function OrderReviewExperience({
  context,
  defaultNotes,
  onSubmitOrder,
  onSuccess,
  showManualOrderHint = false,
  successMessage = t('workspacePage.panels.analysis.createOrderSuccess'),
}: OrderReviewExperienceProps) {
  const normalizedTicker = context.ticker.trim().toUpperCase();
  const orderDraft = context.canonicalOrderDraft;
  const defaultOrderType = orderDraft.orderType;
  const thesis = context.recommendation?.thesis;
  const thesisEducation = thesis?.educationGenerated?.thesis;
  const suggestedEntry = orderDraft.entry;
  const suggestedStop = orderDraft.stop;
  const suggestedTarget = orderDraft.target;
  const suggestedShares = orderDraft.shares;
  const workflow = getWorkflowPresentation(context.recommendation);
  const currency = orderDraft.quoteCurrency;
  const knownCurrentPrice =
    typeof context.close === 'number' && Number.isFinite(context.close) && context.close > 0 ? context.close : null;
  const decisionGates = context.recommendation?.decisionGates;

  const form = useForm<CandidateOrderFormValues>({
    resolver: zodResolver(candidateOrderSchema),
    defaultValues: {
      orderType: defaultOrderType,
      quantity: suggestedShares,
      limitPrice: suggestedEntry,
      stopPrice: suggestedStop,
      targetPrice: suggestedTarget,
      notes: defaultNotes,
    },
  });

  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSucceeded, setSubmitSucceeded] = useState(false);
  const [activeSection, setActiveSection] = useState<ReviewSectionId>('decision');
  const [tradeThesis, setTradeThesis] = useState('');

  useEffect(() => {
    form.reset({
      orderType: defaultOrderType,
      quantity: suggestedShares,
      limitPrice: suggestedEntry,
      stopPrice: suggestedStop,
      targetPrice: suggestedTarget,
      notes: defaultNotes,
    });
    setSubmissionError(null);
    setSubmitSucceeded(false);
    setIsSubmitting(false);
    setActiveSection('decision');
    setTradeThesis('');
  }, [defaultNotes, defaultOrderType, form, suggestedEntry, suggestedShares, suggestedStop, suggestedTarget, normalizedTicker]);

  const orderType = form.watch('orderType') ?? defaultOrderType;
  const guidanceSignal = context.signal;
  const guidance = getSetupExecutionGuidance(guidanceSignal, orderType);
  const quantity = form.watch('quantity') ?? 0;
  const limitPrice = form.watch('limitPrice') ?? 0;
  const stopPrice = form.watch('stopPrice') ?? 0;
  const triggerPriceLabel =
    orderType === 'BUY_STOP' ? t('order.candidateModal.triggerPrice') : t('order.candidateModal.limitPrice');
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
        setupStatus: decisionGates?.setup.status === 'PASS' || decisionGates?.setup.status === 'BLOCK'
          ? decisionGates.setup.status : 'UNKNOWN',
        triggerStatus: decisionGates?.trigger.status ?? 'UNKNOWN',
        dataStatus: context.dataStatus ?? 'unknown',
        dataAsOf: context.dataAsOf,
        targetSource: context.recommendation?.risk.targetSource === 'structural'
          ? 'structural'
          : context.recommendation?.risk.targetSource === 'manual'
            ? 'manual'
            : 'unknown',
        sector: context.sector ?? undefined,
        currency,
        daysToEarnings: context.daysToEarnings,
        strategyId: context.strategyId,
        approvalToken: orderDraft.approvalToken,
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
      <OrderReviewSummary
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        recommendation={context.recommendation}
        workflow={workflow}
        showManualOrderHint={showManualOrderHint}
        knownCurrentPrice={knownCurrentPrice}
        currency={currency}
        suggestedEntry={suggestedEntry}
        suggestedStop={suggestedStop}
        suggestedTarget={suggestedTarget}
        suggestedShares={suggestedShares}
        suggestedRr={orderDraft.rr}
        thesis={thesis}
        thesisEducation={thesisEducation}
        guidance={guidance}
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
                    disabled
                    {...form.register('orderType')}
                  >
                    <option value="BUY_LIMIT">{t('order.candidateModal.orderTypeOptions.buyLimit')}</option>
                    <option value="BUY_STOP">{t('order.candidateModal.orderTypeOptions.buyStop')}</option>
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

              {submissionError ? (
                <div role="alert" className="rounded border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
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
                    disabled={isSubmitting}
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
