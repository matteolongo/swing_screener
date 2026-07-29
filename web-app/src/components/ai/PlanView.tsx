import type { AIAnalysis } from '../../types/api';
import { useI18n } from '../../i18n';
import OrderTicket from '../order/OrderTicket';

interface Props {
  analysis: AIAnalysis;
}

export default function PlanView({ analysis }: Props) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-[var(--text-secondary)]">
        {t('planView.description')}
      </p>
      <OrderTicket analysis={analysis} />
    </div>
  );
}
