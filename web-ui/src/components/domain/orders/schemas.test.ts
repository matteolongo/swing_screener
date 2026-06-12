import { describe, it, expect } from 'vitest';
import { candidateOrderSchema, fillOrderSchema } from './schemas';

const validCandidate = {
  orderType: 'BUY_LIMIT' as const,
  quantity: 10,
  limitPrice: 100,
  stopPrice: 90,
  notes: '',
};

describe('candidateOrderSchema', () => {
  it('accepts a valid entry where limit is above stop', () => {
    expect(candidateOrderSchema.safeParse(validCandidate).success).toBe(true);
  });

  it('rejects quantity below 1', () => {
    const result = candidateOrderSchema.safeParse({ ...validCandidate, quantity: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects a limit price at or below the stop price (issue on stopPrice)', () => {
    const result = candidateOrderSchema.safeParse({ ...validCandidate, limitPrice: 90, stopPrice: 90 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('stopPrice'))).toBe(true);
    }
  });

  it('rejects a non-positive limit price', () => {
    expect(candidateOrderSchema.safeParse({ ...validCandidate, limitPrice: 0 }).success).toBe(false);
  });
});

describe('fillOrderSchema', () => {
  it('accepts a positive price and a date', () => {
    expect(fillOrderSchema.safeParse({ filledPrice: 101.5, filledDate: '2026-06-12' }).success).toBe(true);
  });

  it('rejects a missing filled date', () => {
    expect(fillOrderSchema.safeParse({ filledPrice: 101.5, filledDate: '' }).success).toBe(false);
  });

  it('rejects a non-positive filled price', () => {
    expect(fillOrderSchema.safeParse({ filledPrice: 0, filledDate: '2026-06-12' }).success).toBe(false);
  });
});
