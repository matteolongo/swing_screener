import type { MessageKey } from '@/i18n/types';
import type {
  DecisionGateState,
  RecommendationVerdict,
} from '@/types/recommendation';

export type ExecutionReadinessState =
  | 'READY_FOR_REVIEW'
  | 'WAITING_FOR_TRIGGER'
  | 'PLAN_INCOMPLETE'
  | 'PLAN_BLOCKED'
  | 'TRIGGER_BLOCKED'
  | 'NO_SETUP'
  | 'NOT_READY'
  | 'UNKNOWN';

export type ExecutionReadinessTone = 'success' | 'warning' | 'danger' | 'neutral';

export interface ExecutionReadinessPresentation {
  state: ExecutionReadinessState;
  labelKey: MessageKey;
  tone: ExecutionReadinessTone;
}

const PRESENTATIONS: Record<ExecutionReadinessState, ExecutionReadinessPresentation> = {
  READY_FOR_REVIEW: {
    state: 'READY_FOR_REVIEW',
    labelKey: 'recommendation.readiness.READY_FOR_REVIEW',
    tone: 'success',
  },
  WAITING_FOR_TRIGGER: {
    state: 'WAITING_FOR_TRIGGER',
    labelKey: 'recommendation.readiness.WAITING_FOR_TRIGGER',
    tone: 'warning',
  },
  PLAN_INCOMPLETE: {
    state: 'PLAN_INCOMPLETE',
    labelKey: 'recommendation.readiness.PLAN_INCOMPLETE',
    tone: 'warning',
  },
  PLAN_BLOCKED: {
    state: 'PLAN_BLOCKED',
    labelKey: 'recommendation.readiness.PLAN_BLOCKED',
    tone: 'danger',
  },
  TRIGGER_BLOCKED: {
    state: 'TRIGGER_BLOCKED',
    labelKey: 'recommendation.readiness.TRIGGER_BLOCKED',
    tone: 'danger',
  },
  NO_SETUP: {
    state: 'NO_SETUP',
    labelKey: 'recommendation.readiness.NO_SETUP',
    tone: 'danger',
  },
  NOT_READY: {
    state: 'NOT_READY',
    labelKey: 'recommendation.readiness.NOT_READY',
    tone: 'danger',
  },
  UNKNOWN: {
    state: 'UNKNOWN',
    labelKey: 'recommendation.readiness.UNKNOWN',
    tone: 'neutral',
  },
};

export function deriveExecutionReadiness(
  gates: DecisionGateState | undefined,
  verdict: RecommendationVerdict | 'UNKNOWN' = 'UNKNOWN',
): ExecutionReadinessPresentation {
  if (!gates) {
    if (verdict === 'RECOMMENDED') return PRESENTATIONS.READY_FOR_REVIEW;
    if (verdict === 'NOT_RECOMMENDED') return PRESENTATIONS.NOT_READY;
    return PRESENTATIONS.UNKNOWN;
  }

  if (gates.setup.status === 'BLOCK') return PRESENTATIONS.NO_SETUP;
  if (gates.setup.status !== 'PASS') return PRESENTATIONS.UNKNOWN;

  if (gates.trigger.status === 'WAIT') return PRESENTATIONS.WAITING_FOR_TRIGGER;
  if (gates.trigger.status === 'BLOCK') return PRESENTATIONS.TRIGGER_BLOCKED;
  if (gates.trigger.status !== 'PASS') return PRESENTATIONS.UNKNOWN;

  if (gates.plan.status === 'BLOCK') return PRESENTATIONS.PLAN_BLOCKED;
  if (gates.plan.status !== 'PASS') return PRESENTATIONS.PLAN_INCOMPLETE;

  return PRESENTATIONS.READY_FOR_REVIEW;
}
