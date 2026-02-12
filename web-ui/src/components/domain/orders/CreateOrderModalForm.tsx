import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import ModalShell from '@/components/common/ModalShell';
import Button from '@/components/common/Button';
import type { CreateOrderRequest } from '@/features/portfolio/types';
import { createOrderSchema, type CreateOrderFormValues } from '@/components/domain/orders/schemas';
import { t } from '@/i18n/t';

interface CreateOrderModalFormProps {
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (request: CreateOrderRequest) => void;
}

export default function CreateOrderModalForm({
  isLoading,
  onClose,
  onSubmit,
}: CreateOrderModalFormProps) {
  const form = useForm<CreateOrderFormValues>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      ticker: '',
      orderType: 'BUY_LIMIT',
      orderKind: 'entry',
      quantity: 1,
      limitPrice: 0,
      stopPrice: 0,
      notes: '',
    },
  });

  const handleSubmit = form.handleSubmit((values) => {
    onSubmit({
      ticker: values.ticker.toUpperCase(),
      orderType: values.orderType,
      orderKind: values.orderKind,
      quantity: values.quantity,
      limitPrice: values.limitPrice > 0 ? values.limitPrice : undefined,
      stopPrice: values.stopPrice > 0 ? values.stopPrice : undefined,
      notes: values.notes ?? '',
    });
  });

  return (
    <ModalShell title={t('order.createModal.title')} onClose={onClose} className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t('order.createModal.ticker')}</label>
          <input
            type="text"
            {...form.register('ticker')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('order.createModal.orderType')}</label>
          <select
            {...form.register('orderType')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
          >
            <option value="BUY_LIMIT">{t('order.createModal.orderTypeOptions.buyLimit')}</option>
            <option value="SELL_LIMIT">{t('order.createModal.orderTypeOptions.sellLimit')}</option>
            <option value="BUY_MARKET">{t('order.createModal.orderTypeOptions.buyMarket')}</option>
            <option value="SELL_MARKET">{t('order.createModal.orderTypeOptions.sellMarket')}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('order.createModal.orderKind')}</label>
          <select
            {...form.register('orderKind')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
          >
            <option value="entry">{t('order.createModal.orderKindOptions.entry')}</option>
            <option value="stop">{t('order.createModal.orderKindOptions.stopLoss')}</option>
            <option value="take_profit">{t('order.createModal.orderKindOptions.takeProfit')}</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('order.createModal.quantity')}</label>
            <input
              type="number"
              min="1"
              {...form.register('quantity', { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('order.createModal.limitPrice')}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              {...form.register('limitPrice', { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('order.createModal.stopPrice')}</label>
          <input
            type="number"
            step="0.01"
            min="0"
            {...form.register('stopPrice', { valueAsNumber: true })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('order.createModal.notes')}</label>
          <textarea
            rows={3}
            {...form.register('notes')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
          />
        </div>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
            {t('common.actions.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? t('order.createModal.creating') : t('order.createModal.createAction')}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
