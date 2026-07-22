import { describe, expect, it } from 'vitest';
import type { DecisionGateState, RecommendationVerdict } from '@/types/recommendation';
import { deriveExecutionReadiness } from './readiness';

const passingGates: DecisionGateState = {
  setup: { status: 'PASS', explanation: 'Setup qualifies.' },
  trigger: { status: 'PASS', explanation: 'Trigger observed.' },
  plan: { status: 'PASS', explanation: 'Plan reconciles.' },
  portfolio: { status: 'UNKNOWN', explanation: 'Checked during order review.' },
  readyToOrder: false,
};

function derive(
  gates: DecisionGateState | undefined,
  verdict: RecommendationVerdict | 'UNKNOWN' = 'NOT_RECOMMENDED',
) {
  return deriveExecutionReadiness(gates, verdict);
}

describe('deriveExecutionReadiness', () => {
  it('reports no valid setup before considering later gates', () => {
    expect(derive({
      ...passingGates,
      setup: { status: 'BLOCK', explanation: 'No setup.' },
      trigger: { status: 'WAIT', explanation: 'Waiting.' },
    })).toMatchObject({ state: 'NO_SETUP', tone: 'danger' });
  });

  it('reports unknown readiness when setup qualification is unknown', () => {
    expect(derive({
      ...passingGates,
      setup: { status: 'UNKNOWN', explanation: 'Unknown.' },
    })).toMatchObject({ state: 'UNKNOWN', tone: 'neutral' });
  });

  it('reports waiting when a qualified conditional setup has not triggered', () => {
    expect(derive({
      ...passingGates,
      trigger: { status: 'WAIT', explanation: 'Waiting for pullback.' },
    })).toEqual({
      state: 'WAITING_FOR_TRIGGER',
      labelKey: 'recommendation.readiness.WAITING_FOR_TRIGGER',
      tone: 'warning',
    });
  });

  it('reports a blocked trigger separately from a failed setup', () => {
    expect(derive({
      ...passingGates,
      trigger: { status: 'BLOCK', explanation: 'Trigger invalid.' },
    })).toMatchObject({ state: 'TRIGGER_BLOCKED', tone: 'danger' });
  });

  it('reports unknown readiness when trigger state is unknown', () => {
    expect(derive({
      ...passingGates,
      trigger: { status: 'UNKNOWN', explanation: 'Unknown.' },
    })).toMatchObject({ state: 'UNKNOWN', tone: 'neutral' });
  });

  it('reports an incomplete plan when plan validation is unknown', () => {
    expect(derive({
      ...passingGates,
      plan: { status: 'UNKNOWN', explanation: 'Target required.' },
    })).toMatchObject({ state: 'PLAN_INCOMPLETE', tone: 'warning' });
  });

  it('reports a blocked plan when a risk check fails', () => {
    expect(derive({
      ...passingGates,
      plan: { status: 'BLOCK', explanation: 'Risk too high.' },
    })).toMatchObject({ state: 'PLAN_BLOCKED', tone: 'danger' });
  });

  it('reports ready for order review without claiming portfolio permission', () => {
    expect(derive(passingGates, 'RECOMMENDED')).toEqual({
      state: 'READY_FOR_REVIEW',
      labelKey: 'recommendation.readiness.READY_FOR_REVIEW',
      tone: 'success',
    });
  });

  it.each([
    ['RECOMMENDED', 'READY_FOR_REVIEW', 'success'],
    ['NOT_RECOMMENDED', 'NOT_READY', 'danger'],
    ['UNKNOWN', 'UNKNOWN', 'neutral'],
  ] as const)('falls back from legacy verdict %s to %s', (verdict, state, tone) => {
    expect(derive(undefined, verdict)).toMatchObject({ state, tone });
  });
});
