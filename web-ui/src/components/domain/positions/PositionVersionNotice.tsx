import Button from '@/components/common/Button';
import { t } from '@/i18n/t';
import type { Position } from '@/types/position';
import { formatCurrency } from '@/utils/formatters';

export default function PositionVersionNotice({ position, onReview, disabled, unavailable, onRefresh }: {
  position: Position;
  onReview: () => void;
  disabled: boolean;
  unavailable: boolean;
  onRefresh: () => void;
}) {
  return (
    <div role="alert" className="rounded border border-warning/40 bg-warning/10 p-3 text-sm space-y-2">
      <p>{unavailable ? t('positions.concurrency.unavailable') : t('positions.concurrency.changed', { positionId: position.positionId ?? position.ticker, shares: position.shares, stop: formatCurrency(position.stopPrice), version: position.version ?? 1 })}</p>
      <p>{t('positions.concurrency.preserved')}</p>
      <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={unavailable ? onRefresh : onReview}>
        {t(unavailable ? 'positions.concurrency.refresh' : 'positions.concurrency.review')}
      </Button>
    </div>
  );
}
