import { AlertTriangle } from 'lucide-react';
import { useEarningsProximity } from '@/features/portfolio/hooks';
import { t } from '@/i18n/t';

interface EarningsWarningBannerProps {
  ticker?: string;
}

function warningMessage(daysUntil: number) {
  if (daysUntil === 0) return t('earningsWarning.messageToday');
  if (daysUntil === 1) return t('earningsWarning.messageSingular');
  return t('earningsWarning.message', { days: daysUntil });
}

export default function EarningsWarningBanner({ ticker }: EarningsWarningBannerProps) {
  const { data } = useEarningsProximity(ticker);

  if (!data?.warning || data.daysUntil == null) {
    return null;
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      <span>{warningMessage(data.daysUntil)}</span>
    </div>
  );
}
