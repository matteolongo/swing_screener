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

function roundToCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
  const suggestedStopRounded = suggestedStop != null ? roundToCents(suggestedStop) : null;
  const currentStopRounded = roundToCents(position.stopPrice);
  const canApplySuggested =
    suggestion?.action === 'MOVE_STOP_UP' &&
    suggestedStopRounded != null &&
    suggestedStopRounded > currentStopRounded;

  const initialStop = canApplySuggested && suggestedStopRounded != null ? suggestedStopRounded : currentStopRounded;
  const initialReason = canApplySuggested && suggestion?.reason ? suggestion.reason : '';

  const [formData, setFormData] = useState<UpdateStopRequest>({
    newStop: initialStop,
    reason: initialReason,
  });

  useEffect(() => {
    if (!canApplySuggested || suggestedStopRounded == null) return;

    setFormData((prev) => {
      const isPristine = prev.newStop === initialStop && prev.reason === initialReason;
      if (!isPristine) return prev;
      return {
        newStop: suggestedStopRounded,
        reason: suggestion?.reason || '',
      };
    });
  }, [canApplySuggested, suggestedStopRounded, suggestion?.reason, initialStop, initialReason]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit({
      ...formData,
      newStop: roundToCents(formData.newStop),
    });
  };

  const handleUseSuggested = () => {
    if (!canApplySuggested || suggestedStopRounded == null) return;
    setFormData((prev) => ({
      ...prev,
      newStop: suggestedStopRounded,
      reason: prev.reason || suggestion?.reason || '',
    }));
  };

  const canMoveUp = roundToCents(formData.newStop) > currentStopRounded;

  return (
    <ModalShell title={t('positions.updateStopModal.title', { ticker: position.ticker })} onClose={onClose} className="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('positions.updateStopModal.currentPosition')}</p>
          <p className="text-sm mt-1">
            <strong>{t('positions.updateStopModal.entryLabel')}</strong> {formatCurrency(position.entryPrice)}
          </p>
          <p className="text-sm">
            <strong>{t('positions.updateStopModal.currentStopLabel')}</strong> {formatCurrency(position.stopPrice)}
          </p>
          <p className="text-sm">
            <strong>{t('positions.updateStopModal.sharesLabel')}</strong> {position.shares}
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
                {formatCurrency(suggestedStopRounded ?? currentStopRounded)}
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
            min={currentStopRounded}
            value={formData.newStop}
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, newStop: parseFloat(event.target.value) || 0 }))
            }
            onBlur={() =>
              setFormData((prev) => ({ ...prev, newStop: roundToCents(prev.newStop) }))
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
            required
          />
          {!canMoveUp && roundToCents(formData.newStop) !== currentStopRounded ? (
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

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
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
