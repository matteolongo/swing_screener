import { useState } from 'react';
import { useOrders, useDegiroStatusQuery, useFillOrderMutation, useSubmitOrderMutation } from '@/features/portfolio/hooks';
import { t } from '@/i18n/t';
import type { Order } from '@/types/order';
import FillOrderModalForm from './FillOrderModalForm';

import FillViaDegiroModal from './FillViaDegiroModal';

type ActiveFilter = 'pending' | 'submitted';

export default function PendingOrdersTab() {
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('pending');
  const ordersQuery = useOrders(activeFilter);
  const degiroStatusQuery = useDegiroStatusQuery();
  const [fillDegiroOrder, setFillDegiroOrder] = useState<Order | null>(null);
  const [fillManualOrder, setFillManualOrder] = useState<Order | null>(null);

  const fillMutation = useFillOrderMutation(() => {
    setFillManualOrder(null);
  });

  const submitMutation = useSubmitOrderMutation();

  const orders = (ordersQuery.data ?? []).filter((o) => o.orderKind === 'entry');
  const degiroAvailable = degiroStatusQuery.data?.available ?? false;

  const filterTabs: ActiveFilter[] = ['pending', 'submitted'];

  if (ordersQuery.isLoading) {
    return <p className="text-sm text-gray-500 py-4">{t('common.table.loading')}</p>;
  }

  return (
    <>
      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {filterTabs.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setActiveFilter(f)}
            className={
              activeFilter === f
                ? 'px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary'
                : 'px-3 py-1 rounded-full text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }
          >
            {t(`ordersPage.filter.${f}`)}
          </button>
        ))}
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">{t('pendingOrdersTab.empty')}</p>
      ) : (
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
                  <td className="py-2 pr-4 font-semibold text-gray-900 dark:text-gray-100">
                    {order.ticker}
                    {order.status === 'submitted' && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        {t('ordersPage.filter.submitted')}
                      </span>
                    )}
                  </td>
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
                      {order.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => submitMutation.mutate(order.orderId)}
                          disabled={submitMutation.isPending}
                          className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {t('pendingOrdersTab.markSubmitted')}
                        </button>
                      )}
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
      )}

      {fillDegiroOrder && (
        <FillViaDegiroModal
          order={fillDegiroOrder}
          onClose={() => setFillDegiroOrder(null)}
        />
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
