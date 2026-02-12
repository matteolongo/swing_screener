import { useEffect, useState } from 'react';
import Button from '@/components/common/Button';
import ModalShell from '@/components/common/ModalShell';
import { usePositionStopSuggestion } from '@/features/portfolio/hooks';
import type { Position, UpdateStopRequest } from '@/features/portfolio/types';
import { formatCurrency } from '@/utils/formatters';
import { t } from '@/i18n/t';

interface UpdateStopModalFormProps {
  position: Position;
  isLoading: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (request: UpdateStopRequest) => void;
}

export default function UpdateStopModalForm({
  position,
  isLoading,
  error,
  onClose,
  onSubmit,
}: UpdateStopModalFormProps) {
  const suggestionQuery = usePositionStopSuggestion(position.positionId);
  const suggestion = suggestionQuery.data;
  const suggestionError = suggestionQuery.error instanceof Error ? suggestionQuery.error.message : '';
  const suggestedStop = suggestion?.stopSuggested;
  const canApplySuggested =
    suggestion?.action === 'MOVE_STOP_UP' &&
    suggestedStop != null &&
    suggestedStop > position.stopPrice;

  const initialStop = canApplySuggested && suggestedStop != null ? suggestedStop : position.stopPrice;
  const initialReason = canApplySuggested && suggestion?.reason ? suggestion.reason : '';

  const [formData, setFormData] = useState<UpdateStopRequest>({
    newStop: initialStop,
    reason: initialReason,
  });

  useEffect(() => {
    if (!canApplySuggested || suggestedStop == null) return;

    setFormData((prev) => {
      const isPristine = prev.newStop === initialStop && prev.reason === initialReason;
      if (!isPristine) return prev;
      return {
        newStop: suggestedStop,
        reason: suggestion?.reason || '',
      };
    });
  }, [canApplySuggested, suggestedStop, suggestion?.reason, initialStop, initialReason]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit(formData);
  };

  const handleUseSuggested = () => {
    if (!canApplySuggested || suggestedStop == null) return;
    setFormData((prev) => ({
      ...prev,
      newStop: suggestedStop,
      reason: prev.reason || suggestion?.reason || '',
    }));
  };

  const canMoveUp = formData.newStop > position.stopPrice;

  return (
    <ModalShell title={t('positions.updateStopModal.title', { ticker: position.ticker })} onClose={onClose} className="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('positions.updateStopModal.currentPosition')}</p>
          <p className="text-sm mt-1">
            <strong>Entry:</strong> {formatCurrency(position.entryPrice)}
          </p>
          <p className="text-sm">
            <strong>Current Stop:</strong> {formatCurrency(position.stopPrice)}
          </p>
          <p className="text-sm">
            <strong>Shares:</strong> {position.shares}
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
          <p className="text-sm text-blue-700 dark:text-blue-200 font-semibold">
            {t('positions.updateStopModal.suggestedStop')}
          </p>
          {suggestionQuery.isLoading ? (
            <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">
              {t('positions.updateStopModal.loadingSuggestion')}
            </p>
          ) : suggestionError ? (
            <p className="text-sm text-red-700 dark:text-red-200 mt-1">{suggestionError}</p>
          ) : suggestion ? (
            <div className="text-sm text-blue-800 dark:text-blue-100 mt-2 space-y-1">
              <p>
                <strong>{t('positions.updateStopModal.suggested')}:</strong>{' '}
                {formatCurrency(suggestedStop ?? position.stopPrice)}
              </p>
              <p>
                <strong>{t('positions.updateStopModal.action')}:</strong> {suggestion.action}
              </p>
              <p>
                <strong>{t('positions.updateStopModal.reason')}:</strong> {suggestion.reason}
              </p>
              <p>
                <strong>{t('positions.updateStopModal.rNow')}:</strong> {suggestion.rNow.toFixed(2)}R
              </p>
              {canApplySuggested ? (
                <Button type="button" size="sm" variant="secondary" onClick={handleUseSuggested}>
                  {t('positions.updateStopModal.useSuggested')}
                </Button>
              ) : (
                <p className="text-xs text-blue-700 dark:text-blue-200">
                  {t('positions.updateStopModal.noUpdateSuggested')}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">
              {t('positions.updateStopModal.suggestionUnavailable')}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('positions.updateStopModal.newStopPrice')}</label>
          <input
            type="number"
            step="0.01"
            min={position.stopPrice}
            value={formData.newStop}
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, newStop: parseFloat(event.target.value) || 0 }))
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
            required
          />
          {!canMoveUp && formData.newStop !== position.stopPrice ? (
            <p className="text-sm text-red-600 mt-1">{t('positions.updateStopModal.canOnlyMoveUp')}</p>
          ) : null}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('positions.updateStopModal.reason')}</label>
          <textarea
            rows={2}
            value={formData.reason}
            onChange={(event) => setFormData((prev) => ({ ...prev, reason: event.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
            placeholder={t('positions.updateStopModal.reasonPlaceholder')}
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
          <Button type="submit" variant="primary" disabled={isLoading || !canMoveUp}>
            {isLoading ? t('positions.updateStopModal.updating') : t('common.actions.updateStop')}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
