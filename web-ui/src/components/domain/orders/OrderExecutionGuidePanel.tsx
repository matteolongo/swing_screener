import SetupExecutionGuide from '@/components/domain/orders/SetupExecutionGuide';
import DegiroOrderConfigGuide from '@/components/domain/orders/DegiroOrderConfigGuide';
import { getSetupExecutionGuidance } from '@/features/orders/setupGuidance';
import type { CandidateOrderFormValues } from '@/components/domain/orders/schemas';
import { t } from '@/i18n/t';

interface OrderExecutionGuidePanelProps {
  guidance: ReturnType<typeof getSetupExecutionGuidance>;
  guidanceSignal?: string;
  executionNote?: string | null;
  orderType: CandidateOrderFormValues['orderType'];
  entryPrice: number;
  stopPrice: number;
  quantity: number;
  currency: string;
}

export default function OrderExecutionGuidePanel({
  guidance,
  guidanceSignal,
  executionNote,
  orderType,
  entryPrice,
  stopPrice,
  quantity,
  currency,
}: OrderExecutionGuidePanelProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {t('order.review.executionGuideTitle' as any)}
        </p>
        <div className="mt-2 space-y-2">
          <p>
            <span className="font-semibold">{t('order.setupGuidance.setupLabel')}</span> {t(guidance.setupLabelKey)}
          </p>
          <p>{t(guidance.whatItMeansKey)}</p>
          {executionNote ? (
            <div className="rounded-md border border-primary/40 bg-surface/70 px-3 py-2 text-xs text-primary">
              {executionNote}
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
        <p className="text-xs font-semibold uppercase tracking-wide text-warning">{t('order.review.executionCautionTitle' as any)}</p>
        <p className="mt-2">{t(guidance.cautionKey)}</p>
      </div>

      <details className="rounded-lg border border-border bg-surface p-3">
        <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
          {t('order.review.brokerStepsTitle' as any)}
        </summary>
        <div className="mt-3">
          <SetupExecutionGuide signal={guidanceSignal} />
        </div>
      </details>

      <details className="rounded-lg border border-border bg-surface p-3">
        <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
          {t('order.review.degiroSetupTitle' as any)}
        </summary>
        <div className="mt-3">
          <DegiroOrderConfigGuide
            orderType={orderType}
            entryPrice={entryPrice}
            stopPrice={stopPrice}
            quantity={quantity}
            currency={currency}
          />
        </div>
      </details>
    </div>
  );
}
