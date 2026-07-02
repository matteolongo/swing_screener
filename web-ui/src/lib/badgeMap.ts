import type { BadgeVariant } from '@/components/common/Badge';
import type { StatusTone } from '@/components/common/StatusDot';
import type { MessageKey } from '@/i18n/types';
import type { DecisionAction, DecisionConviction } from '@/features/screener/types';
import type { PositionSignalAction, ThesisDeltaStatus } from '@/features/intelligence/types';
import type { ProbeStatus } from '@/features/datasources/types';

export interface BadgeSpec {
  variant: BadgeVariant;
  labelKey: MessageKey;
}

// No shared exported union exists for these enums elsewhere in the codebase
// (see Step 1 findings in the task report); spellings mirror the API contract.
type DataFreshness = 'final_close' | 'intraday';
type ExhaustionLabel = 'fine' | 'watch' | 'exit';
type OrderReviewCategory = 'stale' | 'still_valid' | 'no_data';
type JobStatus = 'queued' | 'running' | 'completed' | 'done' | 'error' | 'failed';

const FRESHNESS_MAP: Record<DataFreshness, BadgeSpec> = {
  final_close: { variant: 'success', labelKey: 'badges.freshness.finalClose' },
  intraday: { variant: 'warning', labelKey: 'badges.freshness.intraday' },
};

export function freshnessBadge(label: DataFreshness): BadgeSpec {
  return FRESHNESS_MAP[label];
}

const DECISION_ACTION_MAP: Record<DecisionAction, BadgeSpec> = {
  BUY_NOW: { variant: 'primary', labelKey: 'badges.decision.buyNow' },
  BUY_ON_PULLBACK: { variant: 'primary', labelKey: 'badges.decision.buyOnPullback' },
  WAIT_FOR_BREAKOUT: { variant: 'default', labelKey: 'badges.decision.waitForBreakout' },
  WATCH: { variant: 'default', labelKey: 'badges.decision.watch' },
  TACTICAL_ONLY: { variant: 'default', labelKey: 'badges.decision.tacticalOnly' },
  AVOID: { variant: 'default', labelKey: 'badges.decision.avoid' },
  MANAGE_ONLY: { variant: 'default', labelKey: 'badges.decision.manageOnly' },
};

export function decisionActionBadge(action: DecisionAction): BadgeSpec {
  return DECISION_ACTION_MAP[action];
}

const CONVICTION_MAP: Record<DecisionConviction, BadgeSpec> = {
  high: { variant: 'primary', labelKey: 'badges.conviction.high' },
  medium: { variant: 'default', labelKey: 'badges.conviction.medium' },
  low: { variant: 'default', labelKey: 'badges.conviction.low' },
};

export function convictionBadge(level: DecisionConviction): BadgeSpec {
  return CONVICTION_MAP[level];
}

const EXHAUSTION_MAP: Record<ExhaustionLabel, BadgeSpec> = {
  fine: { variant: 'default', labelKey: 'badges.exhaustion.fine' },
  watch: { variant: 'warning', labelKey: 'badges.exhaustion.watch' },
  exit: { variant: 'error', labelKey: 'badges.exhaustion.exit' },
};

export function exhaustionBadge(label: ExhaustionLabel): BadgeSpec {
  return EXHAUSTION_MAP[label];
}

const POSITION_SIGNAL_MAP: Record<PositionSignalAction, BadgeSpec> = {
  HOLD: { variant: 'default', labelKey: 'badges.positionSignal.hold' },
  TRIM: { variant: 'warning', labelKey: 'badges.positionSignal.trim' },
  EXIT: { variant: 'error', labelKey: 'badges.positionSignal.exit' },
};

export function positionSignalBadge(signal: PositionSignalAction): BadgeSpec {
  return POSITION_SIGNAL_MAP[signal];
}

const ORDER_REVIEW_MAP: Record<OrderReviewCategory, BadgeSpec> = {
  stale: { variant: 'warning', labelKey: 'badges.orderReview.stale' },
  still_valid: { variant: 'success', labelKey: 'badges.orderReview.stillValid' },
  no_data: { variant: 'default', labelKey: 'badges.orderReview.noData' },
};

export function orderReviewBadge(category: OrderReviewCategory): BadgeSpec {
  return ORDER_REVIEW_MAP[category];
}

const THESIS_DELTA_MAP: Record<ThesisDeltaStatus, BadgeSpec> = {
  new: { variant: 'primary', labelKey: 'badges.thesisDelta.new' },
  confirmed: { variant: 'success', labelKey: 'badges.thesisDelta.confirmed' },
  weakening: { variant: 'warning', labelKey: 'badges.thesisDelta.weakening' },
  invalidated: { variant: 'error', labelKey: 'badges.thesisDelta.invalidated' },
};

export function thesisDeltaBadge(status: ThesisDeltaStatus): BadgeSpec {
  return THESIS_DELTA_MAP[status];
}

const JOB_STATUS_MAP: Record<JobStatus, BadgeSpec> = {
  queued: { variant: 'default', labelKey: 'badges.job.queued' },
  running: { variant: 'primary', labelKey: 'badges.job.running' },
  completed: { variant: 'success', labelKey: 'badges.job.completed' },
  done: { variant: 'success', labelKey: 'badges.job.completed' },
  error: { variant: 'error', labelKey: 'badges.job.error' },
  failed: { variant: 'error', labelKey: 'badges.job.error' },
};

export function jobStatusBadge(status: JobStatus): BadgeSpec {
  return JOB_STATUS_MAP[status];
}

const PROBE_TONE_MAP: Record<ProbeStatus, StatusTone> = {
  ok: 'ok',
  degraded: 'warn',
  down: 'down',
  not_configured: 'idle',
};

export function probeTone(status: ProbeStatus): StatusTone {
  return PROBE_TONE_MAP[status];
}
