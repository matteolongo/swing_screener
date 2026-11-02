import { useMutationState } from '@tanstack/react-query';
import type { PositionLifecycleResult } from '@/features/portfolio/api';
import { t } from '@/i18n/t';
import { queryKeys } from '@/lib/queryKeys';

export default function PositionProtectionNotice() {
  const changes = useMutationState({
    filters: { mutationKey: queryKeys.positionLifecycle() },
    select: (mutation) => ({
      result: mutation.state.data as PositionLifecycleResult | undefined,
      status: mutation.state.status,
      submittedAt: mutation.state.submittedAt,
      action: mutation.options.mutationKey?.[1],
    }),
  });
  const latest = changes.reduce<(typeof changes)[number] | undefined>(
    (selected, change) => !selected || change.submittedAt >= selected.submittedAt ? change : selected,
    undefined,
  );
  const result = latest?.result;
  if (latest?.status !== 'success' || !result?.linkedOrderIds.length) return null;
  const action = latest.action === 'cancellation' || result.protectionAction === 'cancellation'
    ? 'cancellation' : 'adjustment';

  return (
    <div role="status" className="my-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
      <p>{t(action === 'cancellation' ? 'orders.protection.manualCancellation' : 'orders.protection.manualAdjustment')}</p>
      <p className="mt-1 text-xs text-muted">{t('orders.protection.affectedRecords', { orders: result.linkedOrderIds.join(', ') })}</p>
      {result.sharesRemaining != null ? <p className="text-xs text-muted">{t('orders.protection.remainingShares', { shares: result.sharesRemaining })}</p> : null}
      {result.newStop != null ? <p className="text-xs text-muted">{t('orders.protection.updatedStop', { price: result.newStop.toFixed(2) })}</p> : null}
    </div>
  );
}
