import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import Button from '@/components/common/Button';
import SetupExecutionGuide from '@/components/domain/orders/SetupExecutionGuide';
import { useOrderRiskMetrics } from '@/components/domain/orders/useOrderRiskMetrics';
import { candidateOrderSchema, type CandidateOrderFormValues } from '@/components/domain/orders/schemas';
import { useCreateOrderMutation } from '@/features/portfolio/hooks';
import { useScreenerStore } from '@/stores/screenerStore';
import { useActiveStrategyQuery } from '@/features/strategy/hooks';
import { DEFAULT_CONFIG } from '@/types/config';
import { formatCurrency } from '@/utils/formatters';
import { t } from '@/i18n/t';

interface ActionPanelProps {
  ticker: string;
}

export default function ActionPanel({ ticker }: ActionPanelProps) {
  const normalizedTicker = ticker.trim().toUpperCase();
  const activeStrategyQuery = useActiveStrategyQuery();
  const risk = activeStrategyQuery.data?.risk ?? DEFAULT_CONFIG.risk;
  const candidate = useScreenerStore((state) =>
    state.lastResult?.candidates.find((item) => item.ticker.toUpperCase() === normalizedTicker)
  );

  const hasScreenerCandidate = Boolean(candidate);
  const recRisk = candidate?.recommendation?.risk;
  const fallbackEntry = 100;
  const initialEntry = recRisk?.entry ?? candidate?.entry ?? candidate?.close ?? fallbackEntry;
  const suggestedEntry = Number.isFinite(initialEntry) && initialEntry > 0 ? initialEntry : fallbackEntry;
  const initialStop = recRisk?.stop ?? candidate?.stop ?? suggestedEntry * 0.95;
  const suggestedStop = Math.max(0.01, Math.min(initialStop, suggestedEntry - 0.01));
  const suggestedShares = recRisk?.shares ?? candidate?.shares ?? Math.max(1, risk.minShares);
  const verdict = candidate?.recommendation?.verdict;
  const showRecommendationWarning = verdict === 'NOT_RECOMMENDED';
  const currency = candidate?.currency ?? 'USD';
  const defaultNotes = candidate
    ? t('screener.defaultNotes', {
        score: (candidate.score * 100).toFixed(1),
        rank: candidate.rank,
      })
    : t('workspacePage.panels.analysis.manualOrderNotes', { ticker: normalizedTicker });

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

  useEffect(() => {
    form.reset({
      orderType: 'BUY_LIMIT',
      quantity: suggestedShares,
      limitPrice: parseFloat(suggestedEntry.toFixed(2)),
      stopPrice: parseFloat(suggestedStop.toFixed(2)),
      notes: defaultNotes,
    });
  }, [defaultNotes, form, suggestedEntry, suggestedShares, suggestedStop, ticker]);

  const quantity = form.watch('quantity') ?? 0;
  const limitPrice = form.watch('limitPrice') ?? 0;
  const stopPrice = form.watch('stopPrice') ?? 0;

  const { positionSize, riskAmount, accountPercent, riskPercent } = useOrderRiskMetrics({
    limitPrice,
    stopPrice,
    quantity,
    accountSize: risk.accountSize,
  });

  const createOrderMutation = useCreateOrderMutation();

  const handleSubmit = form.handleSubmit((values) => {
    createOrderMutation.mutate({
      ticker: normalizedTicker,
      orderType: values.orderType,
      quantity: values.quantity,
      limitPrice: values.limitPrice,
      stopPrice: values.stopPrice,
      orderKind: 'entry',
      notes: values.notes?.trim() ?? '',
    });
  });

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('workspacePage.panels.analysis.actionTitle')}
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {t('workspacePage.panels.analysis.actionDescription')}
        </p>
      </div>

      {!hasScreenerCandidate ? (
        <div className="rounded border border-blue-300 bg-blue-50 p-2 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
          {t('workspacePage.panels.analysis.manualOrderHint')}
        </div>
      ) : null}

      {showRecommendationWarning ? (
        <div className="rounded border border-yellow-300 bg-yellow-50 p-2 text-xs text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
          {t('order.candidateModal.notRecommended')}
        </div>
      ) : null}

      <SetupExecutionGuide signal={candidate?.signal} />

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">{t('order.candidateModal.orderType')}</label>
            <select
              {...form.register('orderType')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm"
            >
              <option value="BUY_LIMIT">{t('order.candidateModal.orderTypeOptions.buyLimit')}</option>
              <option value="BUY_MARKET">{t('order.candidateModal.orderTypeOptions.buyMarket')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">{t('order.candidateModal.quantity')}</label>
            <input
              type="number"
              min="1"
              {...form.register('quantity', { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm"
            />
            {form.formState.errors.quantity ? (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.quantity.message}</p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">{t('order.candidateModal.limitPrice')}</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              {...form.register('limitPrice', { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm"
            />
            {form.formState.errors.limitPrice ? (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.limitPrice.message}</p>
            ) : null}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">{t('order.candidateModal.stopPrice')}</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              {...form.register('stopPrice', { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm"
            />
            {form.formState.errors.stopPrice ? (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.stopPrice.message}</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-md bg-gray-50 dark:bg-gray-800 p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span>{t('order.candidateModal.positionSize')}</span>
            <strong>{formatCurrency(positionSize, currency)}</strong>
          </div>
          <div className="flex justify-between">
            <span>{t('order.candidateModal.accountPercent')}</span>
            <strong>{accountPercent.toFixed(1)}%</strong>
          </div>
          <div className="flex justify-between">
            <span>{t('order.candidateModal.riskAmount')}</span>
            <strong>{formatCurrency(riskAmount, currency)}</strong>
          </div>
          <div className="flex justify-between">
            <span>{t('order.candidateModal.riskPercent')}</span>
            <strong className={riskPercent > risk.riskPct * 100 ? 'text-red-600' : 'text-green-600'}>
              {riskPercent.toFixed(2)}%
            </strong>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">{t('order.candidateModal.notes')}</label>
          <textarea
            rows={3}
            {...form.register('notes')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm"
          />
        </div>

        {createOrderMutation.isError ? (
          <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {createOrderMutation.error instanceof Error
              ? createOrderMutation.error.message
              : t('order.candidateModal.createError')}
          </div>
        ) : null}

        {createOrderMutation.isSuccess ? (
          <div className="rounded border border-green-300 bg-green-50 p-2 text-xs text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
            {t('workspacePage.panels.analysis.createOrderSuccess')}
          </div>
        ) : null}

        <Button type="submit" disabled={createOrderMutation.isPending}>
          {createOrderMutation.isPending ? t('order.candidateModal.creating') : t('order.candidateModal.createAction')}
        </Button>
      </form>
    </div>
  );
}
