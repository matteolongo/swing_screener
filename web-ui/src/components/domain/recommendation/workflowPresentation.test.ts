import { describe, expect, it } from 'vitest';
import type { ScreenerCandidate } from '@/features/screener/types';
import {
  canReviewPendingPullbackOrder,
  formatWorkflowNextStep,
  getWorkflowPresentation,
  groupCandidatesByWorkflow,
} from './workflowPresentation';
import { transformRecommendation, type RecommendationAPI } from '@/types/recommendation';

const apiRecommendation: RecommendationAPI = {
  verdict: 'NOT_RECOMMENDED',
  reasons_short: [],
  reasons_detailed: [],
  risk: { entry: 1, risk_amount: 1, risk_pct: 0.01, position_size: 1, shares: 1 },
  costs: { commission_estimate: 0, fx_estimate: 0, slippage_estimate: 0, total_cost: 0 },
  checklist: [],
  education: { common_bias_warning: '', what_to_learn: '', what_would_make_valid: [] },
};

describe('workflow presentation', () => {
  it('allows only signed waiting pullback BUY_LIMIT orders into review', () => {
    expect(canReviewPendingPullbackOrder({
      approvalToken: 'signed-token',
      suggestedOrderType: 'BUY_LIMIT',
      recommendation: {
        workflowStatus: 'waiting_trigger',
        nextStep: { code: 'wait_pullback' },
      },
    })).toBe(true);

    expect(canReviewPendingPullbackOrder({
      suggestedOrderType: 'BUY_LIMIT',
      recommendation: { workflowStatus: 'waiting_trigger', nextStep: { code: 'wait_pullback' } },
    })).toBe(false);
    expect(canReviewPendingPullbackOrder({
      approvalToken: 'signed-token',
      suggestedOrderType: 'BUY_STOP',
      recommendation: { workflowStatus: 'waiting_trigger', nextStep: { code: 'wait_pullback' } },
    })).toBe(false);
    expect(canReviewPendingPullbackOrder({
      approvalToken: 'signed-token',
      suggestedOrderType: 'BUY_LIMIT',
      recommendation: { workflowStatus: 'waiting_trigger', nextStep: { code: 'wait_breakout_close' } },
    })).toBe(false);
  });

  it('formats a concrete pullback instruction', () => {
    expect(formatWorkflowNextStep({
      code: 'wait_pullback',
      triggerPrice: 46.2,
      currency: 'EUR',
    })).toContain('€46.20');
  });

  it('maps an absent recommendation to safe review', () => {
    expect(getWorkflowPresentation(undefined)).toMatchObject({
      status: 'needs_review',
      tone: 'danger',
    });
  });

  it('groups in workflow order while preserving priority inside a group', () => {
    const candidate = (ticker: string, workflowStatus: string) => ({
      ticker,
      recommendation: {
        workflowStatus,
        nextStep: { code: workflowStatus === 'ready' ? 'review_order' : 'observe' },
      },
    } as ScreenerCandidate);
    const groups = groupCandidatesByWorkflow([
      candidate('OBS', 'no_setup'),
      candidate('READY-1', 'ready'),
      candidate('READY-2', 'ready'),
    ]);

    expect(groups.map((group) => group.status)).toEqual([
      'ready', 'waiting_trigger', 'needs_review', 'no_setup',
    ]);
    expect(groups[0].candidates.map((item) => item.ticker)).toEqual(['READY-1', 'READY-2']);
  });

  it('keeps an API candidate with unknown workflow values in the safe review group', () => {
    const recommendation = transformRecommendation(JSON.parse(JSON.stringify({
      ...apiRecommendation,
      workflow_status: 'unknown_runtime_status',
      next_step: { code: 'unknown_runtime_step' },
    })));
    const candidates = JSON.parse(JSON.stringify([{ ticker: 'UNKNOWN', recommendation }]));

    const groups = groupCandidatesByWorkflow(candidates);

    expect(groups[2].status).toBe('needs_review');
    expect(groups[2].candidates.map((candidate) => candidate.ticker)).toEqual(['UNKNOWN']);
  });
});
