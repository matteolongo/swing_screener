import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import TableShell from '@/components/common/TableShell';
import { Order, OrderStatus } from '@/features/portfolio/types';
import {
  useOrders,
  useCreateOrderMutation,
  useFillOrderMutation,
  useCancelOrderMutation,
} from '@/features/portfolio/hooks';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { Plus, X, CheckCircle, MessageSquare } from 'lucide-react';
import SocialAnalysisModal from '@/components/modals/SocialAnalysisModal';
import CreateOrderModalForm from '@/components/domain/orders/CreateOrderModalForm';
import FillOrderModalForm from '@/components/domain/orders/FillOrderModalForm';
import { useBeginnerModeStore } from '@/stores/beginnerModeStore';
import { t } from '@/i18n/t';

type FilterStatus = OrderStatus | 'all';

export default function Orders() {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFillModal, setShowFillModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [socialSymbol, setSocialSymbol] = useState<string | null>(null);
  const { isBeginnerMode } = useBeginnerModeStore();

  const ordersQuery = useOrders(filterStatus);
  const orders = ordersQuery.data ?? [];
  const isLoading = ordersQuery.isLoading;

  const getFilterLabel = (status: FilterStatus): string => {
    const labels: Record<FilterStatus, string> = {
      all: t('ordersPage.filter.all'),
      pending: t('ordersPage.filter.pending'),
      filled: t('ordersPage.filter.filled'),
      cancelled: t('ordersPage.filter.cancelled'),
    };
    return labels[status];
  };

  const getListTitle = (status: FilterStatus): string => {
    const titles: Record<FilterStatus, string> = {
      all: t('ordersPage.listTitle.all'),
      pending: t('ordersPage.listTitle.pending'),
      filled: t('ordersPage.listTitle.filled'),
      cancelled: t('ordersPage.listTitle.cancelled'),
    };
    return titles[status];
  };

  const createOrderMutation = useCreateOrderMutation(() => {
    setShowCreateModal(false);
  });

  const fillOrderMutation = useFillOrderMutation(() => {
    setShowFillModal(false);
    setSelectedOrder(null);
  });

  const cancelOrderMutation = useCancelOrderMutation();

  const handleFillOrder = (order: Order) => {
    setSelectedOrder(order);
    setShowFillModal(true);
  };

  const handleCancelOrder = (orderId: string) => {
    if (confirm(t('ordersPage.confirmCancel'))) {
      cancelOrderMutation.mutate(orderId);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('ordersPage.title')}</h1>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {t('ordersPage.createAction')}
        </Button>
      </div>

      <Card variant="bordered">
        <CardContent>
          <div className="flex gap-2">
            {(['all', 'pending', 'filled', 'cancelled'] as FilterStatus[]).map((status) => (
              <Button
                key={status}
                variant={filterStatus === status ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setFilterStatus(status)}
              >
                {getFilterLabel(status)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card variant="elevated">
        <CardHeader>
          <CardTitle>{getListTitle(filterStatus)}</CardTitle>
        </CardHeader>
        <CardContent>
          <TableShell
            loading={isLoading}
            empty={!isLoading && orders.length === 0}
            emptyMessage={t('ordersPage.empty')}
            headers={(
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-semibold">{t('ordersPage.headers.ticker')}</th>
                {!isBeginnerMode && (
                  <>
                    <th className="text-left py-3 px-4 font-semibold">{t('ordersPage.headers.type')}</th>
                    <th className="text-left py-3 px-4 font-semibold">{t('ordersPage.headers.kind')}</th>
                  </>
                )}
                <th className="text-left py-3 px-4 font-semibold">{t('ordersPage.headers.status')}</th>
                <th className="text-right py-3 px-4 font-semibold">{t('ordersPage.headers.qty')}</th>
                <th className="text-right py-3 px-4 font-semibold">{t('ordersPage.headers.limit')}</th>
                <th className="text-right py-3 px-4 font-semibold">{t('ordersPage.headers.stop')}</th>
                {!isBeginnerMode && (
                  <>
                    <th className="text-left py-3 px-4 font-semibold">{t('ordersPage.headers.created')}</th>
                    <th className="text-left py-3 px-4 font-semibold">{t('ordersPage.headers.notes')}</th>
                  </>
                )}
                <th className="text-right py-3 px-4 font-semibold">{t('ordersPage.headers.actions')}</th>
              </tr>
            )}
          >
            {orders.map((order: Order) => (
              <tr
                key={order.orderId}
                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <td className="py-3 px-4 font-mono font-semibold">
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://finance.yahoo.com/quote/${order.ticker}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                      title={t('ordersPage.yahooTitle', { ticker: order.ticker })}
                    >
                      {order.ticker}
                    </a>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSocialSymbol(order.ticker)}
                      aria-label={t('ordersPage.sentimentAria', { ticker: order.ticker })}
                      title={t('ordersPage.sentimentTitle')}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
                {!isBeginnerMode && (
                  <>
                    <td className="py-3 px-4 text-sm">{order.orderType}</td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          order.orderKind === 'entry'
                            ? 'success'
                            : order.orderKind === 'stop'
                              ? 'error'
                          : 'default'
                        }
                      >
                        {order.orderKind || t('ordersPage.orderKindUnknown')}
                      </Badge>
                    </td>
                  </>
                )}
                <td className="py-3 px-4">
                  <Badge
                    variant={
                      order.status === 'filled'
                        ? 'success'
                        : order.status === 'pending'
                          ? 'warning'
                          : 'default'
                    }
                  >
                    {order.status}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-right">{order.quantity}</td>
                <td className="py-3 px-4 text-right">
                  {order.limitPrice ? formatCurrency(order.limitPrice) : t('common.placeholders.dash')}
                </td>
                <td className="py-3 px-4 text-right">
                  {order.stopPrice ? formatCurrency(order.stopPrice) : t('common.placeholders.dash')}
                </td>
                {!isBeginnerMode && (
                  <>
                    <td className="py-3 px-4 text-sm">{formatDate(order.orderDate)}</td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                      {order.notes || t('ordersPage.notesFallback')}
                    </td>
                  </>
                )}
                <td className="py-3 px-4">
                  <div className="flex justify-end gap-2">
                    {order.status === 'pending' ? (
                      <>
                        <Button size="sm" variant="primary" onClick={() => handleFillOrder(order)}>
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleCancelOrder(order.orderId)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </TableShell>
        </CardContent>
      </Card>

      {showCreateModal ? (
        <CreateOrderModalForm
          onClose={() => setShowCreateModal(false)}
          onSubmit={(request) => createOrderMutation.mutate(request)}
          isLoading={createOrderMutation.isPending}
        />
      ) : null}

      {showFillModal && selectedOrder ? (
        <FillOrderModalForm
          order={selectedOrder}
          onClose={() => {
            setShowFillModal(false);
            setSelectedOrder(null);
          }}
          onSubmit={(request) => fillOrderMutation.mutate({ orderId: selectedOrder.orderId, request })}
          isLoading={fillOrderMutation.isPending}
        />
      ) : null}

      {socialSymbol ? <SocialAnalysisModal symbol={socialSymbol} onClose={() => setSocialSymbol(null)} /> : null}
    </div>
  );
}
