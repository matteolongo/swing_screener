import { useEffect, useState } from 'react';
import Button from '@/components/common/Button';
import Field from '@/components/common/Field';
import Input from '@/components/common/Input';
import ModalShell from '@/components/common/ModalShell';
import TrailMethodSelector from '@/components/domain/positions/TrailMethodSelector';
import { computePositionStopSuggestion } from '@/features/portfolio/api';
import { usePositionStopSuggestion, useUpdateTrailMethodMutation } from '@/features/portfolio/hooks';
import type { Position, PositionUpdate, TrailMethod, UpdateStopRequest } from '@/features/portfolio/types';
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
  const [liveSuggestion, setLiveSuggestion] = useState<PositionUpdate | null>(null);

  const [trailMethod, setTrailMethod] = useState<TrailMethod>(position.trailMethod ?? 'sma20');
  const [trailParam, setTrailParam] = useState<number | null>(position.trailParam ?? null);

  const trailMethodMutation = useUpdateTrailMethodMutation();
  const [trailError, setTrailError] = useState<string>('');

  const suggestion = liveSuggestion ?? suggestionQuery.data;
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

  const handleTrailChange = async (method: TrailMethod, param: number | null) => {
    setTrailMethod(method);
    setTrailParam(param);
    try {
      const computed = await computePositionStopSuggestion({
        ...position,
        trailMethod: method,
        trailParam: param,
      });
      if (computed) {
        setLiveSuggestion(computed);
      }
    } catch {
      setLiveSuggestion(null);
    }
  };

  const trailMethodChanged =
    trailMethod !== (position.trailMethod ?? 'sma20') ||
    trailParam !== (position.trailParam ?? null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTrailError('');
    if (trailMethodChanged && position.positionId) {
      try {
        await trailMethodMutation.mutateAsync({
          positionId: position.positionId,
          request: { trailMethod, trailParam },
        });
      } catch (err) {
        setTrailError(err instanceof Error ? err.message : 'Failed to update trail method');
        return;
      }
    }
    onSubmit({ ...formData, newStop: roundToCents(formData.newStop) });
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
        <div className="bg-foreground/5 p-3 rounded">
          <p className="text-sm text-muted">{t('positions.updateStopModal.currentPosition')}</p>
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

        <TrailMethodSelector value={trailMethod} param={trailParam} onChange={handleTrailChange} />

        <div className="bg-primary/10 p-3 rounded">
          <p className="text-sm text-primary font-semibold">
            {t('positions.updateStopModal.suggestedStop')}
          </p>
          {suggestionQuery.isLoading ? (
            <p className="text-sm text-primary mt-1">
              {t('positions.updateStopModal.loadingSuggestion')}
            </p>
          ) : suggestionError ? (
            <p className="text-sm text-danger mt-1">{suggestionError}</p>
          ) : suggestion ? (
            <div className="text-sm text-primary mt-2 space-y-1">
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
                <p className="text-xs text-primary">
                  {t('positions.updateStopModal.noUpdateSuggested')}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-primary mt-1">
              {t('positions.updateStopModal.suggestionUnavailable')}
            </p>
          )}
        </div>

        <Field label={t('positions.updateStopModal.newStopPrice')}>
          <Input
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
            required
          />
          {!canMoveUp && roundToCents(formData.newStop) !== currentStopRounded ? (
            <p className="text-sm text-danger mt-1">{t('positions.updateStopModal.canOnlyMoveUp')}</p>
          ) : null}
        </Field>

        <div>
          <label className="block text-sm font-medium mb-1">{t('positions.updateStopModal.reason')}</label>
          <textarea
            rows={2}
            value={formData.reason}
            onChange={(event) => setFormData((prev) => ({ ...prev, reason: event.target.value }))}
            className="w-full px-3 py-2 border border-border rounded bg-surface"
            placeholder={t('positions.updateStopModal.reasonPlaceholder')}
          />
        </div>

        {error ? (
          <div className="bg-danger/10 border border-danger/40 rounded p-3">
            <p className="text-sm text-danger">{error}</p>
          </div>
        ) : null}

        {trailError ? (
          <div className="bg-danger/10 border border-danger/40 rounded p-3">
            <p className="text-sm text-danger">{trailError}</p>
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
