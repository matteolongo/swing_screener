import { describe, expect, it } from 'vitest';
import type { ScreenerCandidate } from '@/features/screener/types';
import {
  formatWorkflowNextStep,
  getWorkflowPresentation,
  groupCandidatesByWorkflow,
} from './workflowPresentation';

describe('workflow presentation', () => {
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
});
