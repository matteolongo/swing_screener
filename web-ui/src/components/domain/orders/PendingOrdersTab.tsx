import { useState } from 'react';
import { useOrders, useDegiroStatusQuery, useFillOrderMutation } from '@/features/portfolio/hooks';
import { t } from '@/i18n/t';
import type { Order } from '@/types/order';
import FillOrderModalForm from './FillOrderModalForm';

// TODO (Task 6): import FillViaDegiroModal once it exists

export default function PendingOrdersTab() {
  const ordersQuery = useOrders('pending');
  const degiroStatusQuery = useDegiroStatusQuery();
  const [fillDegiroOrder, setFillDegiroOrder] = useState<Order | null>(null);
  const [fillManualOrder, setFillManualOrder] = useState<Order | null>(null);

  const fillMutation = useFillOrderMutation(() => {
    setFillManualOrder(null);
  });

  const orders = (ordersQuery.data ?? []).filter((o) => o.orderKind === 'entry');
  const degiroAvailable = degiroStatusQuery.data?.available ?? false;

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
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFillDegiroOrder(order)}
                      disabled={!degiroAvailable}
                      title={!degiroAvailable ? t('pendingOrdersTab.degiroNotConnected') : undefined}
                      className="px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {t('pendingOrdersTab.fillViaDegiro')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFillManualOrder(order)}
                      className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                    >
                      {t('pendingOrdersTab.fillManually')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* TODO (Task 6): render FillViaDegiroModal when fillDegiroOrder is set */}
      {fillDegiroOrder && (
        <div className="hidden" aria-hidden="true" />
      )}

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
