import { useState } from 'react';
import { useOrders, useFillOrderMutation } from '@/features/portfolio/hooks';
import { t } from '@/i18n/t';
import type { Order } from '@/types/order';
import FillOrderModalForm from './FillOrderModalForm';

export default function PendingOrdersTab() {
  const ordersQuery = useOrders('pending');
  const [fillManualOrder, setFillManualOrder] = useState<Order | null>(null);

  const fillMutation = useFillOrderMutation(() => {
    setFillManualOrder(null);
  });

  const orders = (ordersQuery.data ?? []).filter((o) => o.orderKind === 'entry');

  if (ordersQuery.isLoading) {
    return <p className="text-sm text-gray-500 py-4">{t('common.table.loading')}</p>;
  }

  if (orders.length === 0) {
    return <p className="text-sm text-gray-500 py-4">{t('pendingOrdersTab.empty')}</p>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="py-2 pr-4 text-left font-medium">{t('pendingOrdersTab.columnTicker')}</th>
              <th className="py-2 pr-4 text-right font-medium">{t('pendingOrdersTab.columnShares')}</th>
              <th className="py-2 pr-4 text-right font-medium">{t('pendingOrdersTab.columnLimit')}</th>
              <th className="py-2 pr-4 text-right font-medium">{t('pendingOrdersTab.columnStop')}</th>
              <th className="py-2 pr-4 text-left font-medium">{t('pendingOrdersTab.columnDate')}</th>
              <th className="py-2 text-left font-medium" />
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order.orderId}
                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                <td className="py-2 pr-4 font-semibold text-gray-900 dark:text-gray-100">{order.ticker}</td>
                <td className="py-2 pr-4 text-right text-gray-700 dark:text-gray-300">{order.quantity}</td>
                <td className="py-2 pr-4 text-right text-gray-700 dark:text-gray-300">
                  {order.limitPrice != null ? order.limitPrice.toFixed(2) : t('common.placeholders.dash')}
                </td>
                <td className="py-2 pr-4 text-right text-gray-700 dark:text-gray-300">
                  {order.stopPrice != null ? order.stopPrice.toFixed(2) : t('common.placeholders.dash')}
                </td>
                <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">{order.orderDate}</td>
                <td className="py-2">
                  <button
                    type="button"
                    onClick={() => setFillManualOrder(order)}
                    className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                  >
                    {t('pendingOrdersTab.fillManually')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {fillManualOrder && (
        <FillOrderModalForm
          order={fillManualOrder}
          isLoading={fillMutation.isPending}
          error={fillMutation.error?.message}
          onClose={() => {
            setFillManualOrder(null);
            fillMutation.reset();
          }}
          onSubmit={(request) => {
            fillMutation.mutate({ orderId: fillManualOrder.orderId, request });
          }}
        />
      )}
    </>
  );
}
