import OrderReviewExperience, { type OrderReviewContext } from '@/components/domain/orders/OrderReviewExperience';
import type { RiskConfig } from '@/types/config';
import type { CreateOrderRequest } from '@/features/portfolio/types';
import { t } from '@/i18n/t';

interface OrderActionPanelProps {
  context: OrderReviewContext;
  risk: RiskConfig;
  defaultNotes: string;
  onSubmitOrder: (request: CreateOrderRequest) => Promise<unknown>;
  onSuccess?: () => void;
  showManualOrderHint?: boolean;
  successMessage?: string;
}

export default function OrderActionPanel({
  context,
  risk,
  defaultNotes,
  onSubmitOrder,
  onSuccess,
  showManualOrderHint = false,
  successMessage,
}: OrderActionPanelProps) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('workspacePage.panels.analysis.actionTitle')}
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {t('workspacePage.panels.analysis.actionDescription')}
        </p>
      </div>

      <OrderReviewExperience
        context={context}
        risk={risk}
        defaultNotes={defaultNotes}
        showManualOrderHint={showManualOrderHint}
        onSubmitOrder={onSubmitOrder}
        onSuccess={onSuccess}
        successMessage={successMessage}
      />
    </div>
  );
}
