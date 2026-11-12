import { t } from '@/i18n/t';

export interface CandidateOrderFormValues {
  orderType: 'BUY_LIMIT' | 'BUY_STOP';
  quantity: number;
  limitPrice: number;
  stopPrice: number;
  targetPrice?: number;
  notes?: string;
}

export type CandidateOrderErrors = Partial<Record<keyof CandidateOrderFormValues, string>>;

const isPositive = (value: number) => Number.isFinite(value) && value > 0;

/** Field errors in form order; price-relationship checks run once every field is valid. */
export function validateCandidateOrder(values: CandidateOrderFormValues): CandidateOrderErrors {
  const errors: CandidateOrderErrors = {};
  if (!Number.isInteger(values.quantity) || values.quantity < 1) {
    errors.quantity = t('order.candidateModal.quantityError');
  }
  if (!isPositive(values.limitPrice)) {
    errors.limitPrice = t('order.candidateModal.limitError');
  }
  if (!isPositive(values.stopPrice)) {
    errors.stopPrice = t('order.candidateModal.stopPositiveError');
  }
  if (values.targetPrice != null && !isPositive(values.targetPrice)) {
    errors.targetPrice = t('order.candidateModal.targetPositiveError');
  }
  if (Object.keys(errors).length > 0) {
    return errors;
  }
  if (values.limitPrice <= values.stopPrice) {
    errors.stopPrice = t('order.candidateModal.stopError');
  }
  if (values.targetPrice != null && values.targetPrice <= values.limitPrice) {
    errors.targetPrice = t('order.candidateModal.targetError');
  }
  return errors;
}
