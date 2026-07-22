import { describe, expect, it } from 'vitest';
import { transformRecommendation, type RecommendationAPI } from './recommendation';

const base: RecommendationAPI = {
  verdict: 'NOT_RECOMMENDED',
  reasons_short: [],
  reasons_detailed: [],
  risk: {
    entry: 98.5,
    risk_amount: 10,
    risk_pct: 0.01,
    position_size: 985,
    shares: 10,
  },
  costs: {
    commission_estimate: 0,
    fx_estimate: 0,
    slippage_estimate: 0,
    total_cost: 0,
  },
  checklist: [],
  education: {
    common_bias_warning: '',
    what_to_learn: '',
    what_would_make_valid: [],
  },
};

describe('transformRecommendation workflow contract', () => {
  it('maps canonical snake_case fields', () => {
    const result = transformRecommendation({
      ...base,
      workflow_status: 'waiting_trigger',
      next_step: { code: 'wait_pullback', trigger_price: 98.5, currency: 'USD' },
    });

    expect(result.workflowStatus).toBe('waiting_trigger');
    expect(result.nextStep).toEqual({
      code: 'wait_pullback',
      triggerPrice: 98.5,
      currency: 'USD',
    });
  });

  it('fails safely when an older backend omits workflow fields', () => {
    const result = transformRecommendation(base);

    expect(result.workflowStatus).toBe('needs_review');
    expect(result.nextStep).toEqual({ code: 'refresh_data' });
  });
});
