import { describe, it, expect } from 'vitest';
import { validateCandidateOrder } from './schemas';
import { t } from '@/i18n/t';

const validCandidate = {
  orderType: 'BUY_LIMIT' as const,
  quantity: 10,
  limitPrice: 100,
  stopPrice: 90,
  notes: '',
};

describe('validateCandidateOrder', () => {
  it('accepts a valid entry where limit is above stop', () => {
    expect(validateCandidateOrder(validCandidate)).toEqual({});
  });

  it('rejects quantity below 1', () => {
    expect(validateCandidateOrder({ ...validCandidate, quantity: 0 }).quantity).toBe(
      t('order.candidateModal.quantityError'),
    );
  });

  it('rejects a limit price at or below the stop price on the stop field', () => {
    expect(validateCandidateOrder({ ...validCandidate, limitPrice: 90, stopPrice: 90 }).stopPrice).toBe(
      t('order.candidateModal.stopError'),
    );
  });

  it('rejects a target at or below the limit price', () => {
    expect(validateCandidateOrder({ ...validCandidate, targetPrice: 100 }).targetPrice).toBe(
      t('order.candidateModal.targetError'),
    );
  });

  it('rejects a non-positive limit price', () => {
    expect(validateCandidateOrder({ ...validCandidate, limitPrice: 0 }).limitPrice).toBe(
      t('order.candidateModal.limitError'),
    );
  });

  it('rejects non-finite order values', () => {
    for (const values of [
      { quantity: Infinity },
      { quantity: NaN },
      { limitPrice: Infinity },
      { stopPrice: NaN },
      { targetPrice: Infinity },
    ]) {
      expect(Object.keys(validateCandidateOrder({ ...validCandidate, ...values }))).not.toHaveLength(0);
    }
  });
});
