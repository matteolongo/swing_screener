import { useState } from 'react';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import Textarea from '@/components/common/Textarea';
import ModalShell from '@/components/common/ModalShell';
import type { ClosePositionRequest, Position } from '@/features/portfolio/types';
import { formatCurrency, formatPercent, getSignColorClass } from '@/utils/formatters';
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
        <div className="bg-foreground/5 p-3 rounded">
          <p className="text-sm text-muted">{t('positions.closeModal.positionDetails')}</p>
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
          <Input
            id="close-position-exit-price"
            type="number"
            step="0.01"
            min="0.01"
            value={exitPriceValue}
            onChange={(event) => setExitPriceValue(event.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="close-position-fee-eur" className="block text-sm font-medium mb-1">
            {t('positions.closeModal.feeEurOptional')}
          </label>
          <Input
            id="close-position-fee-eur"
            type="number"
            step="0.01"
            min="0"
            value={feeEurValue}
            onChange={(event) => setFeeEurValue(event.target.value)}
          />
        </div>

        <div
          className={`p-3 rounded ${pnl >= 0 ? 'bg-success/10' : 'bg-danger/10'}`}
        >
          <p className="text-sm font-medium">{t('positions.closeModal.projectedPnlNet')}</p>
          <p className={`text-lg font-bold ${getSignColorClass(pnl)}`}>
            {pnl >= 0 ? '+' : ''}
            {formatCurrency(pnl)} ({pnl >= 0 ? '+' : ''}
            {formatPercent(pnlPercent)})
          </p>
        </div>

        <div>
          <label htmlFor="close-position-reason" className="block text-sm font-medium mb-1">
            {t('positions.closeModal.reason')}
          </label>
          <Textarea
            id="close-position-reason"
            rows={2}
            value={reasonValue}
            onChange={(event) => setReasonValue(event.target.value)}
            placeholder={t('positions.closeModal.reasonPlaceholder')}
          />
        </div>

        <div>
          <label htmlFor="close-position-lesson" className="block text-xs font-medium text-muted-foreground mb-1">
            {t('positions.closeModal.lessonOptional')}
          </label>
          <Textarea
            id="close-position-lesson"
            rows={3}
            value={lessonValue}
            onChange={(event) => setLessonValue(event.target.value)}
            placeholder={t('positions.closeModal.lessonPlaceholder')}
          />
        </div>

        {exitPriceValue ? (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-muted">
              {t('tradeTags.stepTitle')}
            </p>
            <p className="mb-3 text-xs text-muted">{t('tradeTags.stepHint')}</p>
            <div className="flex flex-wrap gap-2">
              {TRADE_TAGS.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    selectedTags.includes(tag.id)
                      ? 'border-primary/40 bg-primary text-white'
                      : 'border-border bg-surface text-muted hover:border-primary/40',
                  )}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {formError ? (
          <div className="bg-danger/10 border border-danger/40 rounded p-3">
            <p className="text-sm text-danger">{formError}</p>
          </div>
        ) : null}

        {error ? (
          <div className="bg-danger/10 border border-danger/40 rounded p-3">
            <p className="text-sm text-danger">{error}</p>
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
