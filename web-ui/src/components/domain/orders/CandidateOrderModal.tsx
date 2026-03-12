import ModalShell from '@/components/common/ModalShell';
import OrderReviewExperience, { type OrderReviewContext } from '@/components/domain/orders/OrderReviewExperience';
import { createOrder } from '@/features/portfolio/api';
import type { RiskConfig } from '@/types/config';
import { t } from '@/i18n/t';

export type CandidateOrderInput = OrderReviewContext;

interface CandidateOrderModalProps {
  candidate: CandidateOrderInput;
  risk: RiskConfig;
  defaultNotes: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CandidateOrderModal({
  candidate,
  risk,
  defaultNotes,
  onClose,
  onSuccess,
}: CandidateOrderModalProps) {
  return (
    <ModalShell
      title={t('order.candidateModal.title', { ticker: candidate.ticker })}
      onClose={onClose}
      className="max-w-5xl"
      closeAriaLabel={t('order.candidateModal.closeAria')}
    >
      <OrderReviewExperience
        context={candidate}
        risk={risk}
        defaultNotes={defaultNotes}
        enforceRecommendation
        onSubmitOrder={createOrder}
        onSuccess={onSuccess}
      />
    </ModalShell>
  );
}
