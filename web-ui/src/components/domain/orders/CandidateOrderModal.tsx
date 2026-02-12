import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import ModalShell from '@/components/common/ModalShell';
import RecommendationSummary from '@/components/domain/recommendation/RecommendationSummary';
import { createOrder } from '@/features/portfolio/api';
import type { CreateOrderRequest } from '@/features/portfolio/types';
import type { Recommendation } from '@/types/recommendation';
import type { RiskConfig } from '@/types/config';
import { candidateOrderSchema, type CandidateOrderFormValues } from '@/components/domain/orders/schemas';
import { useOrderRiskMetrics } from '@/components/domain/orders/useOrderRiskMetrics';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import Button from '@/components/common/Button';
import { t } from '@/i18n/t';

export interface CandidateOrderInput {
  ticker: string;
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
  currency?: 'USD' | 'EUR';
}

interface CandidateOrderModalProps {
  candidate: CandidateOrderInput;
  risk: RiskConfig;
  defaultNotes: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CandidateOrderModal({
  candidate,
  risk,
  defaultNotes,
  onClose,
  onSuccess,
}: CandidateOrderModalProps) {
  const recRisk = candidate.recommendation?.risk;
  const suggestedEntry = recRisk?.entry ?? candidate.entry ?? candidate.close ?? 0;
  const suggestedStop = recRisk?.stop ?? candidate.stop ?? 0;
  const suggestedShares = recRisk?.shares ?? candidate.shares ?? risk.minShares;
  const verdict = candidate.recommendation?.verdict ?? 'NOT_RECOMMENDED';
  const isRecommended = verdict === 'RECOMMENDED';
  const currency = candidate.currency ?? 'USD';

  const form = useForm<CandidateOrderFormValues>({
    resolver: zodResolver(candidateOrderSchema),
    defaultValues: {
      orderType: 'BUY_LIMIT',
      quantity: suggestedShares,
      limitPrice: parseFloat(suggestedEntry.toFixed(2)),
      stopPrice: parseFloat(suggestedStop.toFixed(2)),
      notes: defaultNotes,
    },
  });

  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const quantity = form.watch('quantity') ?? 0;
  const limitPrice = form.watch('limitPrice') ?? 0;
  const stopPrice = form.watch('stopPrice') ?? 0;

  const { positionSize, riskAmount, accountPercent, riskPercent } = useOrderRiskMetrics({
    limitPrice,
    stopPrice,
    quantity,
    accountSize: risk.accountSize,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmissionError(null);
    setIsSubmitting(true);

    if (!isRecommended) {
      setSubmissionError(t('order.candidateModal.notRecommended'));
      setIsSubmitting(false);
      return;
    }

    try {
      const request: CreateOrderRequest = {
        ticker: candidate.ticker,
        orderType: values.orderType,
        quantity: values.quantity,
        limitPrice: values.limitPrice,
        stopPrice: values.stopPrice,
        notes: values.notes,
        orderKind: 'entry',
      };
      await createOrder(request);
      onSuccess();
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : t('order.candidateModal.createError'));
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <ModalShell
      title={t('order.candidateModal.title', { ticker: candidate.ticker })}
      onClose={onClose}
      className="max-w-2xl"
      closeAriaLabel={t('order.candidateModal.closeAria')}
    >
      <div className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded">
          <h3 className="font-semibold mb-2">{t('order.candidateModal.candidateDetails')}</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">{t('recommendation.labels.entry')}:</span>{' '}
              <strong>{formatCurrency(suggestedEntry, currency)}</strong>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">{t('recommendation.labels.stop')}:</span>{' '}
              <strong>{formatCurrency(suggestedStop, currency)}</strong>
            </div>
            {candidate.rReward != null ? (
              <div>
                <span className="text-gray-600 dark:text-gray-400">R:R:</span>{' '}
                <strong className="text-green-600">{formatNumber(candidate.rReward, 1)}R</strong>
              </div>
            ) : null}
            {candidate.sector ? (
              <div>
                <span className="text-gray-600 dark:text-gray-400">
                  {t('order.candidateModal.labels.sector')}:
                </span>{' '}
                <strong>{candidate.sector}</strong>
              </div>
            ) : null}
            {candidate.atr != null ? (
              <div>
                <span className="text-gray-600 dark:text-gray-400">{t('order.candidateModal.labels.atr')}:</span>{' '}
                <strong>{candidate.atr.toFixed(2)}</strong>
              </div>
            ) : null}
            {candidate.score != null ? (
              <div>
                <span className="text-gray-600 dark:text-gray-400">
                  {t('order.candidateModal.labels.score')}:
                </span>{' '}
                <strong>{candidate.score.toFixed(1)}</strong>
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2">{t('order.candidateModal.recommendation')}</h3>
          <RecommendationSummary recommendation={candidate.recommendation} />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('order.candidateModal.orderType')}</label>
              <select
                {...form.register('orderType')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
              >
                <option value="BUY_LIMIT">BUY LIMIT</option>
                <option value="BUY_MARKET">BUY MARKET</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{t('order.candidateModal.quantity')}</label>
              <input
                type="number"
                min="1"
                {...form.register('quantity', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
              />
              {form.formState.errors.quantity ? (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.quantity.message}</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('order.candidateModal.limitPrice')}</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                {...form.register('limitPrice', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
              />
              {form.formState.errors.limitPrice ? (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.limitPrice.message}</p>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{t('order.candidateModal.stopPrice')}</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                {...form.register('stopPrice', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
              />
              {form.formState.errors.stopPrice ? (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.stopPrice.message}</p>
              ) : null}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded">
            <h3 className="font-semibold mb-2">{t('order.candidateModal.positionSummary')}</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">{t('order.candidateModal.positionSize')}:</span>{' '}
                <strong>{formatCurrency(positionSize, currency)}</strong>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">{t('order.candidateModal.accountPercent')}:</span>{' '}
                <strong>{accountPercent.toFixed(1)}%</strong>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">{t('order.candidateModal.riskAmount')}:</span>{' '}
                <strong className="text-red-600">{formatCurrency(riskAmount, currency)}</strong>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">{t('order.candidateModal.riskPercent')}:</span>{' '}
                <strong className={riskPercent > risk.riskPct * 100 ? 'text-red-600' : 'text-green-600'}>
                  {riskPercent.toFixed(2)}%
                </strong>
              </div>
            </div>
            {riskPercent > risk.riskPct * 100 ? (
              <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-2">
                {t('order.candidateModal.riskExceeded', { riskPct: (risk.riskPct * 100).toFixed(1) })}
              </p>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('order.candidateModal.notes')}</label>
            <textarea
              rows={3}
              {...form.register('notes')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
            />
          </div>

          {submissionError ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
              <p className="text-sm text-red-800 dark:text-red-200">{submissionError}</p>
            </div>
          ) : null}

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              {t('common.actions.cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting || !isRecommended}>
              {isSubmitting ? t('order.candidateModal.creating') : t('order.candidateModal.createAction')}
            </Button>
          </div>
        </form>
      </div>
    </ModalShell>
  );
}
