import type { AIAnalysis } from '../../types/api';
import OrderTicket from '../order/OrderTicket';

interface Props {
  analysis: AIAnalysis;
}

export default function PlanView({ analysis }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-[var(--text-secondary)]">
        Review and adjust the trade plan below.
      </p>
      <OrderTicket analysis={analysis} />
    </div>
  );
}
