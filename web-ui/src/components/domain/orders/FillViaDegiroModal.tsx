import { useState } from 'react';
import ModalShell from '@/components/common/ModalShell';
import Button from '@/components/common/Button';
import { useDegiroOrderHistory, useFillFromDegiroMutation } from '@/features/portfolio/hooks';
import type { Order, DegiroOrder } from '@/types/order';
import { t } from '@/i18n/t';

interface FillViaDegiroModalProps {
  order: Order;
  onClose: () => void;
}

export default function FillViaDegiroModal({ order, onClose }: FillViaDegiroModalProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const historyQuery = useDegiroOrderHistory();
  const fillMutation = useFillFromDegiroMutation(onClose);

  const allOrders = historyQuery.data ?? [];
  const buyOrders = allOrders.filter((o) => o.side === 'buy');
  const tickerMatches = buyOrders.filter(
    (o) => (o.productName ?? '').toUpperCase().includes(order.ticker)
  );
  const otherBuys = buyOrders.filter(
    (o) => !(o.productName ?? '').toUpperCase().includes(order.ticker)
  );

  const selectedOrder = buyOrders.find((o) => o.orderId === selectedOrderId) ?? null;
  const quantityMismatch = selectedOrder !== null && selectedOrder.quantity !== order.quantity;

  function renderRow(o: DegiroOrder) {
    const isSelected = o.orderId === selectedOrderId;
    return (
      <tr
        key={o.orderId}
        onClick={() => setSelectedOrderId(o.orderId)}
        className={`cursor-pointer border-b border-gray-100 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-blue-950 ${
          isSelected ? 'bg-blue-100 dark:bg-blue-900' : ''
        }`}
      >
        <td className="py-2 pr-3 text-sm text-gray-900 dark:text-gray-100">
          {o.productName ?? o.orderId}
        </td>
        <td className="py-2 pr-3 text-sm text-right text-gray-700 dark:text-gray-300">
          {o.price != null ? o.price.toFixed(2) : t('common.placeholders.dash')}
        </td>
        <td className="py-2 pr-3 text-sm text-right text-gray-700 dark:text-gray-300">
          {o.quantity}
        </td>
        <td className="py-2 text-sm text-gray-500 dark:text-gray-400">
          {o.createdAt?.slice(0, 10) ?? t('common.placeholders.dash')}
        </td>
      </tr>
    );
  }

  return (
    <ModalShell
      title={t('fillViaDegiroModal.title', { ticker: order.ticker })}
      onClose={onClose}
      closeAriaLabel={t('modal.closeAria')}
      className="max-w-lg"
    >
      {historyQuery.isLoading && (
        <p className="text-sm text-gray-500 py-4">{t('fillViaDegiroModal.loading')}</p>
      )}

      {historyQuery.isError && (
        <p className="text-sm text-red-600 dark:text-red-400 py-2">{t('fillViaDegiroModal.errorFetch')}</p>
      )}

      {!historyQuery.isLoading && !historyQuery.isError && buyOrders.length === 0 && (
        <p className="text-sm text-gray-500 py-4">{t('fillViaDegiroModal.noOrders')}</p>
      )}

      {buyOrders.length > 0 && (
        <div className="mb-4 overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="py-1 pr-3 text-left font-medium">{t('fillViaDegiroModal.columnProduct')}</th>
                <th className="py-1 pr-3 text-right font-medium">{t('fillViaDegiroModal.columnPrice')}</th>
                <th className="py-1 pr-3 text-right font-medium">{t('fillViaDegiroModal.columnQty')}</th>
                <th className="py-1 text-left font-medium">{t('fillViaDegiroModal.columnDate')}</th>
              </tr>
            </thead>
            <tbody>
              {tickerMatches.map(renderRow)}
              {otherBuys.length > 0 && tickerMatches.length > 0 && (
                <tr>
                  <td colSpan={4} className="py-1 text-xs text-gray-400 dark:text-gray-500 italic">
                    {t('fillViaDegiroModal.otherSection')}
                  </td>
                </tr>
              )}
              {otherBuys.map(renderRow)}
            </tbody>
          </table>
        </div>
      )}

      {quantityMismatch && selectedOrder && (
        <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200">
          {t('fillViaDegiroModal.quantityMismatch', {
            degiroQty: String(selectedOrder.quantity),
            localQty: String(order.quantity),
          })}
        </div>
      )}

      {fillMutation.isError && (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400">
          {(fillMutation.error as Error)?.message ?? t('common.errors.generic')}
        </p>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="primary"
          disabled={!selectedOrderId || fillMutation.isPending}
          onClick={() => {
            if (selectedOrderId) {
              fillMutation.mutate({ orderId: order.orderId, degiroOrderId: selectedOrderId });
            }
          }}
          className="flex-1"
        >
          {t('fillViaDegiroModal.confirmButton')}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('fillViaDegiroModal.cancelButton')}
        </Button>
      </div>
    </ModalShell>
  );
}
