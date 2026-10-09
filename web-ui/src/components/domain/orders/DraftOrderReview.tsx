import { useEffect, useState } from 'react';
import Button from '@/components/common/Button';
import ModalShell from '@/components/common/ModalShell';
import AnalysisDecisionStrip from '@/components/domain/workspace/AnalysisDecisionStrip';
import ActionPanel from '@/components/domain/workspace/ActionPanel';
import { useCandidateAnalysis } from '@/features/workspaceData/useCandidateAnalysis';
import type { Order } from '@/types/order';
import { getCanonicalOrderDraft } from '@/features/screener/types';
import { t } from '@/i18n/t';

export default function DraftOrderReview({ order, onClose }: { order: Order; onClose: () => void }) {
  const analysis = useCandidateAnalysis(order.ticker, null);
  const [useCurrentPlan, setUseCurrentPlan] = useState(false);
  const approvedPlan = getCanonicalOrderDraft(analysis.candidate);
  const mismatch = approvedPlan && (order.orderType !== approvedPlan.orderType || order.quoteCurrency !== approvedPlan.quoteCurrency);
  const savedDraft = approvedPlan && useCurrentPlan ? { ...order, orderType: approvedPlan.orderType, quoteCurrency: approvedPlan.quoteCurrency, quantity: approvedPlan.shares, limitPrice: approvedPlan.entry, stopPrice: approvedPlan.stop, targetPrice: approvedPlan.target } : order;
  useEffect(() => { analysis.refresh(); }, [order.orderId]);
  return (
    <ModalShell title={t('manualOrderDraft.reviewTitle', { ticker: order.ticker })} onClose={onClose} className="max-w-3xl" closeOnBackdrop={false}>
      <div className="space-y-4">
        <p className="text-sm text-warning">{t('manualOrderDraft.approvalRequired')}</p>
        <AnalysisDecisionStrip ticker={order.ticker} candidate={analysis.candidate} candidateRefresh={{ onRefresh: analysis.refresh, isPending: analysis.isPending, error: analysis.error, asOf: analysis.refreshedResult?.asofDate ?? null, freshness: analysis.refreshedResult?.dataFreshness }} />
        {!analysis.isPending && approvedPlan && mismatch && !useCurrentPlan ? <div className="space-y-2"><p className="text-sm text-warning">{t('manualOrderDraft.planMismatch')}</p><Button onClick={() => setUseCurrentPlan(true)}>{t('manualOrderDraft.useCurrentPlan')}</Button></div> : null}
        {!analysis.isPending && approvedPlan && (!mismatch || useCurrentPlan) ? <ActionPanel ticker={order.ticker} candidate={analysis.candidate} draftOrderId={order.orderId} savedDraft={savedDraft} /> : null}
      </div>
    </ModalShell>
  );
}
