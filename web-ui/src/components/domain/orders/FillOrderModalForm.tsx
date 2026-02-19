import { useState } from 'react';
import Button from '@/components/common/Button';
import ModalShell from '@/components/common/ModalShell';
import type { FillOrderRequest, Order } from '@/features/portfolio/types';
import { formatCurrency } from '@/utils/formatters';
import { t } from '@/i18n/t';

interface FillOrderModalFormProps {
  order: Order;
  isLoading: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (request: FillOrderRequest) => void;
}

function toLocalDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parsePositiveNumber(value: string): number | null {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export default function FillOrderModalForm({
  order,
  isLoading,
  error,
  onClose,
  onSubmit,
}: FillOrderModalFormProps) {
  const isEntryOrder = (order.orderKind ?? 'entry') === 'entry';
  const defaultStopPrice = order.stopPrice;
  const requiresStopPrice = isEntryOrder && (defaultStopPrice == null || defaultStopPrice <= 0);

  const [filledPriceValue, setFilledPriceValue] = useState(() => {
    const initialPrice = order.limitPrice ?? order.entryPrice ?? defaultStopPrice ?? 0;
    return initialPrice > 0 ? initialPrice.toFixed(2) : '';
  });
  const [filledDateValue, setFilledDateValue] = useState(() => toLocalDateInputValue(new Date()));
  const [stopPriceValue, setStopPriceValue] = useState(() => (
    defaultStopPrice && defaultStopPrice > 0 ? defaultStopPrice.toFixed(2) : ''
  ));
  const [feeEurValue, setFeeEurValue] = useState('');
  const [fillFxRateValue, setFillFxRateValue] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const filledPrice = parsePositiveNumber(filledPriceValue);
    if (filledPrice == null) {
      setFormError(t('order.fillModal.invalidNumber'));
      return;
    }

    if (!filledDateValue.trim()) {
      setFormError(t('common.errors.generic'));
      return;
    }

    let stopPrice: number | undefined;
    if (stopPriceValue.trim().length > 0) {
      const parsedStop = parsePositiveNumber(stopPriceValue);
      if (parsedStop == null) {
        setFormError(t('order.fillModal.invalidNumber'));
        return;
      }
      stopPrice = parsedStop;
    }

    if (requiresStopPrice && stopPrice == null) {
      setFormError(t('order.fillModal.stopRequired'));
      return;
    }

    let feeEur: number | undefined;
    if (feeEurValue.trim().length > 0) {
      const parsedFee = Number.parseFloat(feeEurValue);
      if (!Number.isFinite(parsedFee) || parsedFee < 0) {
        setFormError(t('order.fillModal.invalidNumber'));
        return;
      }
      feeEur = parsedFee;
    }

    let fillFxRate: number | undefined;
    if (fillFxRateValue.trim().length > 0) {
      const parsedRate = parsePositiveNumber(fillFxRateValue);
      if (parsedRate == null) {
        setFormError(t('order.fillModal.invalidNumber'));
        return;
      }
      fillFxRate = parsedRate;
    }

    onSubmit({
      filledPrice,
      filledDate: filledDateValue,
      stopPrice,
      feeEur,
      fillFxRate,
    });
  };

  return (
    <ModalShell
      title={t('order.fillModal.title', { ticker: order.ticker })}
      onClose={onClose}
      className="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('order.fillModal.orderDetails')}</p>
          <p className="text-sm mt-1">
            <strong>{t('order.fillModal.type')}</strong> {order.orderType}
          </p>
          <p className="text-sm">
            <strong>{t('order.fillModal.quantity')}</strong> {order.quantity}
          </p>
          {order.limitPrice ? (
            <p className="text-sm">
              <strong>{t('order.fillModal.limit')}</strong> {formatCurrency(order.limitPrice)}
            </p>
          ) : null}
          {order.stopPrice ? (
            <p className="text-sm">
              <strong>{t('order.fillModal.stop')}</strong> {formatCurrency(order.stopPrice)}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="fill-order-filled-price" className="block text-sm font-medium mb-1">
            {t('order.fillModal.filledPrice')}
          </label>
          <input
            id="fill-order-filled-price"
            type="number"
            step="0.01"
            min="0.01"
            value={filledPriceValue}
            onChange={(event) => setFilledPriceValue(event.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
            required
          />
        </div>

        <div>
          <label htmlFor="fill-order-filled-date" className="block text-sm font-medium mb-1">
            {t('order.fillModal.filledDate')}
          </label>
          <input
            id="fill-order-filled-date"
            type="date"
            value={filledDateValue}
            onChange={(event) => setFilledDateValue(event.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
            required
          />
        </div>

        <div>
          <label htmlFor="fill-order-stop-price" className="block text-sm font-medium mb-1">
            {t('order.fillModal.linkedStopPrice')}
          </label>
          <input
            id="fill-order-stop-price"
            type="number"
            step="0.01"
            min="0.01"
            value={stopPriceValue}
            onChange={(event) => setStopPriceValue(event.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
            required={requiresStopPrice}
          />
        </div>

        <div>
          <label htmlFor="fill-order-fee-eur" className="block text-sm font-medium mb-1">
            {t('order.fillModal.feeEurOptional')}
          </label>
          <input
            id="fill-order-fee-eur"
            type="number"
            step="0.01"
            min="0"
            value={feeEurValue}
            onChange={(event) => setFeeEurValue(event.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
          />
        </div>

        <div>
          <label htmlFor="fill-order-fx-rate" className="block text-sm font-medium mb-1">
            {t('order.fillModal.fxRateOptional')}
          </label>
          <input
            id="fill-order-fx-rate"
            type="number"
            step="0.0001"
            min="0.0001"
            value={fillFxRateValue}
            onChange={(event) => setFillFxRateValue(event.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
          />
        </div>

        {formError ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
            <p className="text-sm text-red-800 dark:text-red-200">{formError}</p>
          </div>
        ) : null}

        {error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        ) : null}

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
            {t('common.actions.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? t('order.fillModal.filling') : t('order.fillModal.fillAction')}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
