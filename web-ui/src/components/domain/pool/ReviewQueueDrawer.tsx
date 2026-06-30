import ModalShell from '@/components/common/ModalShell';
import Button from '@/components/common/Button';
import { t } from '@/i18n/t';
import { useReviewQueue, useRemoveFromPool, useRestoreToPool } from '@/features/pool/hooks';

interface ReviewQueueDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function ReviewQueueDrawer({ open, onClose }: ReviewQueueDrawerProps) {
  const { data: entries = [], isLoading } = useReviewQueue();
  const remove = useRemoveFromPool();
  const restore = useRestoreToPool();

  if (!open) return null;

  const busy = remove.isPending || restore.isPending;

  return (
    <ModalShell title={t('reviewQueue.title')} onClose={onClose}>
      {isLoading ? (
        <div className="p-4 text-sm text-muted">{t('common.table.loading')}</div>
      ) : entries.length === 0 ? (
        <div className="p-4 text-sm text-muted">{t('reviewQueue.empty')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2">{t('reviewQueue.columns.symbol')}</th>
                <th className="px-3 py-2">{t('reviewQueue.columns.exchange')}</th>
                <th className="px-3 py-2">{t('reviewQueue.columns.capTier')}</th>
                <th className="px-3 py-2">{t('reviewQueue.columns.sector')}</th>
                <th className="px-3 py-2">{t('reviewQueue.columns.failures')}</th>
                <th className="px-3 py-2">{t('reviewQueue.columns.lastFailed')}</th>
                <th className="px-3 py-2">{t('reviewQueue.columns.reason')}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.symbol} className="border-t border-border">
                  <td className="px-3 py-2 font-medium text-foreground">{e.symbol}</td>
                  <td className="px-3 py-2 text-muted">{e.exchangeMic ?? '—'}</td>
                  <td className="px-3 py-2 text-muted">{e.capTier ?? '—'}</td>
                  <td className="px-3 py-2 text-muted">{e.sector ?? '—'}</td>
                  <td className="px-3 py-2 text-muted">{e.failureCount}</td>
                  <td className="px-3 py-2 text-muted">{e.lastFailedAt}</td>
                  <td className="px-3 py-2 text-muted">{e.reason}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => restore.mutate(e.symbol)}
                      >
                        {t('reviewQueue.actions.keep')}
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        disabled={busy}
                        onClick={() => remove.mutate(e.symbol)}
                      >
                        {t('reviewQueue.actions.remove')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ModalShell>
  );
}
