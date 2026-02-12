import { useState } from 'react';
import Button from '@/components/common/Button';
import ModalShell from '@/components/common/ModalShell';
import type { ClosePositionRequest, Position } from '@/features/portfolio/types';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { t } from '@/i18n/t';

interface ClosePositionModalFormProps {
  position: Position;
  isLoading: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (request: ClosePositionRequest) => void;
}

export default function ClosePositionModalForm({
  position,
  isLoading,
  error,
  onClose,
  onSubmit,
}: ClosePositionModalFormProps) {
  const [formData, setFormData] = useState<ClosePositionRequest>({
    exitPrice: position.entryPrice,
    reason: '',
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit(formData);
  };

  const pnl = (formData.exitPrice - position.entryPrice) * position.shares;
  const pnlPercent = ((formData.exitPrice - position.entryPrice) / position.entryPrice) * 100;

  return (
    <ModalShell title={t('positions.closeModal.title', { ticker: position.ticker })} onClose={onClose} className="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('positions.closeModal.positionDetails')}</p>
          <p className="text-sm mt-1">
            <strong>Entry:</strong> {formatCurrency(position.entryPrice)}
          </p>
          <p className="text-sm">
            <strong>Shares:</strong> {position.shares}
          </p>
          <p className="text-sm">
            <strong>Stop:</strong> {formatCurrency(position.stopPrice)}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('positions.closeModal.exitPrice')}</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={formData.exitPrice}
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, exitPrice: parseFloat(event.target.value) || 0 }))
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
            required
          />
        </div>

        <div
          className={`p-3 rounded ${pnl >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}
        >
          <p className="text-sm font-medium">{t('positions.closeModal.projectedPnl')}</p>
          <p
            className={`text-lg font-bold ${
              pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}
          >
            {pnl >= 0 ? '+' : ''}
            {formatCurrency(pnl)} ({pnl >= 0 ? '+' : ''}
            {formatPercent(pnlPercent)})
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('positions.closeModal.reason')}</label>
          <textarea
            rows={2}
            value={formData.reason}
            onChange={(event) => setFormData((prev) => ({ ...prev, reason: event.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
            placeholder={t('positions.closeModal.reasonPlaceholder')}
          />
        </div>

        {error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        ) : null}

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
            {t('common.actions.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? t('positions.closeModal.closing') : t('positions.closeModal.action')}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
