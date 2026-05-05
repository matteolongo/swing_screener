import { useState } from 'react';
import Button from '@/components/common/Button';
import ModalShell from '@/components/common/ModalShell';
import type { ClosePositionRequest, Position } from '@/features/portfolio/types';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';

interface ClosePositionModalFormProps {
  position: Position;
  isLoading: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (request: ClosePositionRequest) => void;
}

function parsePositiveNumber(value: string): number | null {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parseNonNegativeNumber(value: string): number | null {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

const TAG_GROUPS = [
  {
    key: 'setup',
    tags: [
      { id: 'breakout', label: t('tradeTags.breakout') },
      { id: 'pullback', label: t('tradeTags.pullback') },
      { id: 'add_on', label: t('tradeTags.addOn') },
    ],
  },
  {
    key: 'exit',
    tags: [
      { id: 'stop_hit', label: t('tradeTags.stopHit') },
      { id: 'target_reached', label: t('tradeTags.targetReached') },
      { id: 'time_stop', label: t('tradeTags.timeStop') },
      { id: 'manual_exit', label: t('tradeTags.manualExit') },
    ],
  },
  {
    key: 'condition',
    tags: [
      { id: 'trending', label: t('tradeTags.trending') },
      { id: 'choppy', label: t('tradeTags.choppy') },
      { id: 'news_driven', label: t('tradeTags.newsDriven') },
    ],
  },
];

const TRADE_TAGS = TAG_GROUPS.flatMap((group) => group.tags);

export default function ClosePositionModalForm({
  position,
  isLoading,
  error,
  onClose,
  onSubmit,
}: ClosePositionModalFormProps) {
  const [exitPriceValue, setExitPriceValue] = useState(() => position.entryPrice.toFixed(2));
  const [feeEurValue, setFeeEurValue] = useState('');
  const [reasonValue, setReasonValue] = useState('');
  const [lessonValue, setLessonValue] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const buildRequest = (tags: string[]): ClosePositionRequest | null => {
    setFormError(null);

    const exitPrice = parsePositiveNumber(exitPriceValue);
    if (exitPrice == null) {
      setFormError(t('order.fillModal.invalidNumber'));
      return null;
    }

    let feeEur: number | undefined;
    if (feeEurValue.trim().length > 0) {
      const parsedFee = parseNonNegativeNumber(feeEurValue);
      if (parsedFee == null) {
        setFormError(t('order.fillModal.invalidNumber'));
        return null;
      }
      feeEur = parsedFee;
    }

    return {
      exitPrice,
      feeEur,
      reason: reasonValue,
      lesson: lessonValue.trim() || undefined,
      tags,
    };
  };

  const submitWithTags = (tags: string[]) => {
    const request = buildRequest(tags);
    if (request) {
      onSubmit(request);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    submitWithTags(selectedTags);
  };

  const toggleTag = (id: string) => {
    setSelectedTags((current) =>
      current.includes(id) ? current.filter((tag) => tag !== id) : [...current, id],
    );
  };

  const parsedExitPrice = Number.parseFloat(exitPriceValue);
  const previewExitPrice = Number.isFinite(parsedExitPrice) ? parsedExitPrice : 0;
  const parsedFee = Number.parseFloat(feeEurValue);
  const previewFee = Number.isFinite(parsedFee) && parsedFee >= 0 ? parsedFee : 0;
  const entryValue = position.entryPrice * position.shares;
  const pnl = (previewExitPrice - position.entryPrice) * position.shares - previewFee;
  const pnlPercent = entryValue > 0 ? (pnl / entryValue) * 100 : 0;

  return (
    <ModalShell title={t('positions.closeModal.title', { ticker: position.ticker })} onClose={onClose} className="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('positions.closeModal.positionDetails')}</p>
          <p className="text-sm mt-1">
            <strong>{t('positions.closeModal.entryLabel')}</strong> {formatCurrency(position.entryPrice)}
          </p>
          <p className="text-sm">
            <strong>{t('positions.closeModal.sharesLabel')}</strong> {position.shares}
          </p>
          <p className="text-sm">
            <strong>{t('positions.closeModal.stopLabel')}</strong> {formatCurrency(position.stopPrice)}
          </p>
        </div>

        <div>
          <label htmlFor="close-position-exit-price" className="block text-sm font-medium mb-1">
            {t('positions.closeModal.exitPrice')}
          </label>
          <input
            id="close-position-exit-price"
            type="number"
            step="0.01"
            min="0.01"
            value={exitPriceValue}
            onChange={(event) => setExitPriceValue(event.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
            required
          />
        </div>

        <div>
          <label htmlFor="close-position-fee-eur" className="block text-sm font-medium mb-1">
            {t('positions.closeModal.feeEurOptional')}
          </label>
          <input
            id="close-position-fee-eur"
            type="number"
            step="0.01"
            min="0"
            value={feeEurValue}
            onChange={(event) => setFeeEurValue(event.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
          />
        </div>

        <div
          className={`p-3 rounded ${pnl >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}
        >
          <p className="text-sm font-medium">{t('positions.closeModal.projectedPnlNet')}</p>
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
          <label htmlFor="close-position-reason" className="block text-sm font-medium mb-1">
            {t('positions.closeModal.reason')}
          </label>
          <textarea
            id="close-position-reason"
            rows={2}
            value={reasonValue}
            onChange={(event) => setReasonValue(event.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
            placeholder={t('positions.closeModal.reasonPlaceholder')}
          />
        </div>

        <div>
          <label htmlFor="close-position-lesson" className="block text-xs font-medium text-muted-foreground mb-1">
            {t('positions.closeModal.lessonOptional')}
          </label>
          <textarea
            id="close-position-lesson"
            rows={3}
            value={lessonValue}
            onChange={(event) => setLessonValue(event.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
            placeholder={t('positions.closeModal.lessonPlaceholder')}
          />
        </div>

        {exitPriceValue ? (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('tradeTags.stepTitle')}
            </p>
            <p className="mb-3 text-xs text-gray-500">{t('tradeTags.stepHint')}</p>
            <div className="flex flex-wrap gap-2">
              {TRADE_TAGS.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    selectedTags.includes(tag.id)
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300',
                  )}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {formError ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
            <p className="text-sm text-red-800 dark:text-red-200">{formError}</p>
          </div>
        ) : null}

        {error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
            {t('common.actions.cancel')}
          </Button>
          {exitPriceValue ? (
            <Button type="button" variant="secondary" onClick={() => submitWithTags([])} disabled={isLoading}>
              {t('closePositionModal.skipTags')}
            </Button>
          ) : null}
          <Button type="button" variant="primary" onClick={() => submitWithTags(selectedTags)} disabled={isLoading}>
            {isLoading ? t('positions.closeModal.closing') : t('closePositionModal.confirmClose')}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
