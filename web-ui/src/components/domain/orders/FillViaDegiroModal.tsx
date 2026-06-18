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

const FILLABLE_DEGIRO_STATUSES = new Set(['confirmed', 'executed', 'filled', 'complete', 'completed']);

function isFillableBuyOrder(order: DegiroOrder): boolean {
  return (
    order.side === 'buy'
    && order.price != null
    && order.quantity > 0
    && FILLABLE_DEGIRO_STATUSES.has(order.status.trim().toLowerCase())
  );
}

export default function FillViaDegiroModal({ order, onClose }: FillViaDegiroModalProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const historyQuery = useDegiroOrderHistory();
  const fillMutation = useFillFromDegiroMutation(onClose);

  const allOrders = historyQuery.data ?? [];
  const buyOrders = allOrders.filter(isFillableBuyOrder);
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
        className={`cursor-pointer border-b border-border hover:bg-primary/10 ${
          isSelected ? 'bg-primary/10' : ''
        }`}
      >
        <td className="py-2 pr-3 text-sm text-foreground">
          {o.productName ?? o.orderId}
        </td>
        <td className="py-2 pr-3 text-sm text-right text-muted">
          {o.price != null ? o.price.toFixed(2) : t('common.placeholders.dash')}
        </td>
        <td className="py-2 pr-3 text-sm text-right text-muted">
          {o.quantity}
        </td>
        <td className="py-2 text-sm text-muted">
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
        <p className="text-sm text-muted py-4">{t('fillViaDegiroModal.loading')}</p>
      )}

      {historyQuery.isError && (
        <p className="text-sm text-danger py-2">{t('fillViaDegiroModal.errorFetch')}</p>
      )}

      {!historyQuery.isLoading && !historyQuery.isError && buyOrders.length === 0 && (
        <p className="text-sm text-muted py-4">{t('fillViaDegiroModal.noOrders')}</p>
      )}

      {buyOrders.length > 0 && (
        <div className="mb-4 overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="text-xs text-muted border-b border-border">
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
                  <td colSpan={4} className="py-1 text-xs text-muted italic">
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
        <div className="mb-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          {t('fillViaDegiroModal.quantityMismatch', {
            degiroQty: String(selectedOrder.quantity),
            localQty: String(order.quantity),
          })}
        </div>
      )}

      {fillMutation.isError && (
        <p className="mb-3 text-sm text-danger">
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
