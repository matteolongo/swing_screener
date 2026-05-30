import { t } from '@/i18n/t';
import { formatCurrency } from '@/utils/formatters';

type EntryOrderType = 'BUY_LIMIT' | 'BUY_STOP' | 'BUY_MARKET';

interface DegiroOrderConfigGuideProps {
  orderType: EntryOrderType;
  entryPrice: number;
  stopPrice: number;
  quantity: number;
  currency: string;
}

export default function DegiroOrderConfigGuide({
  orderType,
  entryPrice,
  stopPrice,
  quantity,
  currency,
}: DegiroOrderConfigGuideProps) {
  const entryType =
    orderType === 'BUY_STOP'
      ? t('order.candidateModal.degiroEntryTypeStop')
      : orderType === 'BUY_MARKET'
        ? t('order.candidateModal.degiroEntryTypeMarket')
        : t('order.candidateModal.degiroEntryTypeLimit');

  const entryPriceLabel =
    orderType === 'BUY_STOP'
      ? t('order.candidateModal.degiroEntryPriceStopLabel')
      : orderType === 'BUY_MARKET'
        ? t('order.candidateModal.degiroEntryPriceMarketLabel')
        : t('order.candidateModal.degiroEntryPriceLimitLabel');

  const entryPriceValue =
    orderType === 'BUY_MARKET'
      ? t('order.candidateModal.degiroEntryPriceMarketValue')
      : formatCurrency(entryPrice, currency);

  return (
    <div className="rounded border border-cyan-200 bg-cyan-50/70 p-3 text-xs text-cyan-900 dark:border-cyan-900 dark:bg-cyan-950/20 dark:text-cyan-100">
      <p className="font-semibold">{t('order.candidateModal.degiroConfigTitle')}</p>

      <p className="mt-2 font-semibold">{t('order.candidateModal.degiroConfigEntryStep')}</p>
      <p className="mt-1">{t('order.candidateModal.degiroConfigEntryType', { entryType })}</p>
      <p className="mt-1">
        {t('order.candidateModal.degiroConfigEntryPriceLabel', {
          label: entryPriceLabel,
          price: entryPriceValue,
        })}
      </p>
      <p className="mt-1">
        {t('order.candidateModal.degiroConfigEntryQuantity', { quantity: Math.max(0, quantity).toString() })}
      </p>

      <p className="mt-2 font-semibold">{t('order.candidateModal.degiroConfigProtectionStep')}</p>
      <p className="mt-1">{t('order.candidateModal.degiroConfigProtectionType')}</p>
      <p className="mt-1">
        {t('order.candidateModal.degiroConfigProtectionPrice', {
          price: formatCurrency(stopPrice, currency),
        })}
      </p>
      <p className="mt-1">
        {t('order.candidateModal.degiroConfigProtectionQuantity', { quantity: Math.max(0, quantity).toString() })}
      </p>

      <p className="mt-2">{t('order.candidateModal.degiroConfigTerminology')}</p>
    </div>
  );
}
