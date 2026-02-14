import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import ModalShell from '@/components/common/ModalShell';
import Button from '@/components/common/Button';
import type { FillOrderRequest, Order } from '@/features/portfolio/types';
import { fillOrderSchema, type FillOrderFormValues } from '@/components/domain/orders/schemas';
import { formatCurrency } from '@/utils/formatters';
import { t } from '@/i18n/t';

interface FillOrderModalFormProps {
  order: Order;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (request: FillOrderRequest) => void;
}

export default function FillOrderModalForm({
  order,
  isLoading,
  onClose,
  onSubmit,
}: FillOrderModalFormProps) {
  const form = useForm<FillOrderFormValues>({
    resolver: zodResolver(fillOrderSchema),
    defaultValues: {
      filledPrice: order.limitPrice || 0,
      filledDate: new Date().toISOString().split('T')[0],
      stopPrice: order.orderKind === 'entry' ? (order.stopPrice || 0) : undefined,
    },
  });

  const handleSubmit = form.handleSubmit((values) => {
    onSubmit({
      filledPrice: values.filledPrice,
      filledDate: values.filledDate,
      stopPrice: order.orderKind === 'entry' ? values.stopPrice : undefined,
    });
  });

  return (
    <ModalShell
      title={t('order.fillModal.title', { ticker: order.ticker })}
      onClose={onClose}
      className="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t('order.fillModal.filledPrice')}</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            {...form.register('filledPrice', { valueAsNumber: true })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('order.fillModal.filledDate')}</label>
          <input
            type="date"
            {...form.register('filledDate')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
            required
          />
        </div>

        {order.orderKind === 'entry' ? (
          <div>
            <label className="block text-sm font-medium mb-1">
              {t('order.fillModal.linkedStopPrice')}
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              {...form.register('stopPrice', { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
              required
            />
          </div>
        ) : null}

        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('order.fillModal.orderDetails')}</p>
          <p className="text-sm mt-1">
            <strong>{t('order.fillModal.type')}:</strong> {order.orderType}
          </p>
          <p className="text-sm">
            <strong>{t('order.fillModal.quantity')}:</strong> {order.quantity}
          </p>
          {order.limitPrice ? (
            <p className="text-sm">
              <strong>{t('order.fillModal.limit')}:</strong> {formatCurrency(order.limitPrice)}
            </p>
          ) : null}
          {order.stopPrice ? (
            <p className="text-sm">
              <strong>{t('order.fillModal.stop')}:</strong> {formatCurrency(order.stopPrice)}
            </p>
          ) : null}
        </div>

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
