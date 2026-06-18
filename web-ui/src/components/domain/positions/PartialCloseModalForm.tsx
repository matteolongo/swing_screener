import { useState } from 'react';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import ModalShell from '@/components/common/ModalShell';
import RChip from '@/components/common/RChip';
import type { PartialCloseRequest, Position } from '@/features/portfolio/types';
import { formatCurrency, getSignColorClass } from '@/utils/formatters';
import { t } from '@/i18n/t';

interface PartialCloseModalFormProps {
  position: Position;
  isLoading: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (request: PartialCloseRequest) => void;
}

function parsePositiveFloat(value: string): number | null {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parsePositiveInt(value: string): number | null {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function PartialCloseModalForm({
  position,
  isLoading,
  error,
  onClose,
  onSubmit,
}: PartialCloseModalFormProps) {
  const defaultShares = Math.max(1, Math.floor(position.shares / 2));
  const [sharesValue, setSharesValue] = useState(String(defaultShares));
  const [priceValue, setPriceValue] = useState(position.entryPrice.toFixed(2));
  const [feeEurValue, setFeeEurValue] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const parsedShares = parsePositiveInt(sharesValue) ?? 0;
  const parsedPrice = parsePositiveFloat(priceValue) ?? 0;
  const perShareRisk = position.entryPrice - position.stopPrice;
  const rAtClose = perShareRisk !== 0 ? (parsedPrice - position.entryPrice) / perShareRisk : 0;
  const lockedProfit = (parsedPrice - position.entryPrice) * parsedShares;
  const remainingShares = position.shares - parsedShares;
  const remainingRisk = perShareRisk * remainingShares;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const shares = parsePositiveInt(sharesValue);
    if (shares == null || shares < 1 || shares >= position.shares) {
      setFormError(
        shares != null && shares >= position.shares
          ? t('positions.partialCloseModal.errorTooManyShares')
          : t('positions.partialCloseModal.errorInvalidShares', { max: String(position.shares - 1) }),
      );
      return;
    }

    const price = parsePositiveFloat(priceValue);
    if (price == null) {
      setFormError(t('positions.partialCloseModal.errorInvalidPrice'));
      return;
    }

    const feeEurStr = feeEurValue.trim();
    const feeEur =
      feeEurStr.length > 0 && Number.parseFloat(feeEurStr) >= 0
        ? Number.parseFloat(feeEurStr)
        : undefined;

    onSubmit({ sharesClosed: shares, price, feeEur });
  };

  return (
    <ModalShell
      title={t('positions.partialCloseModal.title', { ticker: position.ticker })}
      onClose={onClose}
      className="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Position summary */}
        <div className="bg-foreground/5 p-3 rounded text-sm space-y-1">
          <p><strong>{t('positions.closeModal.entryLabel')}</strong> {formatCurrency(position.entryPrice)}</p>
          <p><strong>{t('positions.closeModal.sharesLabel')}</strong> {position.shares}</p>
          <p><strong>{t('positions.closeModal.stopLabel')}</strong> {formatCurrency(position.stopPrice)}</p>
        </div>

        {/* Shares to close */}
        <div>
          <label htmlFor="partial-close-shares" className="block text-sm font-medium mb-1">
            {t('positions.partialCloseModal.sharesLabel')}
          </label>
          <Input
            id="partial-close-shares"
            type="number"
            step="1"
            min="1"
            max={position.shares - 1}
            value={sharesValue}
            onChange={(e) => setSharesValue(e.target.value)}
            required
          />
        </div>

        {/* Price */}
        <div>
          <label htmlFor="partial-close-price" className="block text-sm font-medium mb-1">
            {t('positions.partialCloseModal.priceLabel')}
          </label>
          <Input
            id="partial-close-price"
            type="number"
            step="0.01"
            min="0.01"
            value={priceValue}
            onChange={(e) => setPriceValue(e.target.value)}
            required
          />
        </div>

        {/* Fee */}
        <div>
          <label htmlFor="partial-close-fee" className="block text-sm font-medium mb-1">
            {t('positions.partialCloseModal.feeEurOptional')}
          </label>
          <Input
            id="partial-close-fee"
            type="number"
            step="0.01"
            min="0"
            value={feeEurValue}
            onChange={(e) => setFeeEurValue(e.target.value)}
          />
        </div>

        {/* Live preview */}
        {parsedShares > 0 && parsedPrice > 0 && (
          <div className="bg-primary/10 p-3 rounded text-sm space-y-1">
            <p className="font-medium">{t('positions.partialCloseModal.preview')}</p>
            <p>
              <span className="text-muted">{t('positions.partialCloseModal.rAtClose')}: </span>
              <RChip value={rAtClose} className="font-mono" />
            </p>
            <p>
              <span className="text-muted">{t('positions.partialCloseModal.lockedProfit')}: </span>
              <span className={getSignColorClass(lockedProfit)}>
                {lockedProfit >= 0 ? '+' : ''}{formatCurrency(lockedProfit)}
              </span>
            </p>
            <p>
              <span className="text-muted">{t('positions.partialCloseModal.remainingShares')}: </span>
              {remainingShares}
            </p>
            <p>
              <span className="text-muted">{t('positions.partialCloseModal.remainingRisk')}: </span>
              {formatCurrency(remainingRisk)}
            </p>
          </div>
        )}

        {formError && (
          <div className="bg-danger/10 border border-danger/40 rounded p-3">
            <p className="text-sm text-danger">{formError}</p>
          </div>
        )}

        {error && (
          <div className="bg-danger/10 border border-danger/40 rounded p-3">
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
            {t('common.actions.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? t('positions.closeModal.closing') : t('positions.partialCloseModal.submit')}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
