import type { ScreenerCandidate, DecisionAction } from '@/features/screener/types';
import { prioritizeCandidates } from '@/features/screener/prioritization';
import { formatCurrency } from '@/utils/formatters';

// ── Public types ────────────────────────────────────────────────────────────

export type BeginnerOrderReadiness =
  | 'ready'
  | 'wait_for_price'
  | 'watch_only'
  | 'avoid'
  | 'manage_existing'
  | 'incomplete';

export type BeginnerSetupQuality = 'pass' | 'caution' | 'fail' | 'incomplete';

export interface BeginnerDecision {
  ticker: string;
  setupQuality: BeginnerSetupQuality;
  suggestedAction: DecisionAction;
  orderReadiness: BeginnerOrderReadiness;
  headline: string;
  plainReason: string;
  mainRisk?: string;
  invalidation?: string;
  nextStepLabel: string;
  nextStepKind:
    | 'review_candidate'
    | 'prepare_order'
    | 'watch'
    | 'wait'
    | 'avoid'
    | 'update_stop'
    | 'close_position'
    | 'review_pending_order'
    | 'run_screener'
    | 'no_action';
}

// ── Readiness fallback labels (used when no decisionSummary) ────────────────

const READINESS_FALLBACK_REASON: Record<BeginnerOrderReadiness, string> = {
  ready: 'Setup timing looks ready to act on.',
  wait_for_price: 'Wait for a better price before entering.',
  watch_only: 'Keep on the watchlist — not ready to act yet.',
  avoid: 'No clear edge here. Skip for now.',
  manage_existing: 'There is already an active position — focus on managing it.',
  incomplete: 'Not enough information to make a recommendation.',
};

// ── Human-readable action labels ────────────────────────────────────────────

const ACTION_LABELS: Record<DecisionAction, string> = {
  BUY_NOW: 'Buy now',
  BUY_ON_PULLBACK: 'Buy on pullback',
  WAIT_FOR_BREAKOUT: 'Wait for breakout',
  WATCH: 'Watch',
  TACTICAL_ONLY: 'Tactical only',
  AVOID: 'Avoid',
  MANAGE_ONLY: 'Manage existing',
};

/**
 * Human-readable label for a DecisionAction.
 */
export function plainActionLabel(action: DecisionAction): string {
  return ACTION_LABELS[action];
}

// ── toOrderReadiness ────────────────────────────────────────────────────────

/**
 * Maps a ScreenerCandidate to a BeginnerOrderReadiness value.
 *
 * Mapping:
 *   BUY_NOW              → ready
 *   BUY_ON_PULLBACK      → wait_for_price
 *   WAIT_FOR_BREAKOUT    → wait_for_price
 *   WATCH                → watch_only
 *   TACTICAL_ONLY        → incomplete (if warnings exist or no recommendation)
 *                        → watch_only (otherwise)
 *   AVOID                → avoid
 *   MANAGE_ONLY          → manage_existing
 *   No decisionSummary   → incomplete
 */
export function toOrderReadiness(candidate: ScreenerCandidate): BeginnerOrderReadiness {
  const action = candidate.decisionSummary?.action;

  if (action === undefined) {
    return 'incomplete';
  }

  switch (action) {
    case 'BUY_NOW':
      return 'ready';
    case 'BUY_ON_PULLBACK':
    case 'WAIT_FOR_BREAKOUT':
      return 'wait_for_price';
    case 'WATCH':
      return 'watch_only';
    case 'TACTICAL_ONLY': {
      const hasWarnings = (candidate.decisionSummary?.drivers?.warnings?.length ?? 0) > 0;
      const hasRecommendation = candidate.recommendation !== undefined;
      return hasWarnings || !hasRecommendation ? 'incomplete' : 'watch_only';
    }
    case 'AVOID':
      return 'avoid';
    case 'MANAGE_ONLY':
      return 'manage_existing';
  }
}

// ── toSetupQuality ──────────────────────────────────────────────────────────

/**
 * Maps a ScreenerCandidate to a BeginnerSetupQuality value.
 *
 * - RECOMMENDED + no major warnings + weeklyTrend !== 'down' → pass
 * - RECOMMENDED + (warnings OR weeklyTrend === 'down')       → caution
 * - NOT_RECOMMENDED                                          → fail
 * - Missing recommendation / decisionSummary                 → incomplete
 */
export function toSetupQuality(candidate: ScreenerCandidate): BeginnerSetupQuality {
  if (candidate.recommendation === undefined || candidate.decisionSummary === undefined) {
    return 'incomplete';
  }

  if (candidate.recommendation.verdict === 'NOT_RECOMMENDED') {
    return 'fail';
  }

  // verdict === 'RECOMMENDED' from here
  const hasWarnings = (candidate.decisionSummary.drivers?.warnings?.length ?? 0) > 0;
  const trendDown = candidate.weeklyTrend === 'down';

  if (hasWarnings || trendDown) {
    return 'caution';
  }

  return 'pass';
}

// ── nextStep helpers ────────────────────────────────────────────────────────

type NextStepKind = BeginnerDecision['nextStepKind'];

interface NextStep {
  kind: NextStepKind;
  label: string;
}

function nextStepForReadiness(readiness: BeginnerOrderReadiness): NextStep {
  switch (readiness) {
    case 'ready':
      return { kind: 'prepare_order', label: 'Prepare order' };
    case 'wait_for_price':
      return { kind: 'wait', label: 'Review price plan' };
    case 'watch_only':
      return { kind: 'watch', label: 'Watch' };
    case 'avoid':
      return { kind: 'avoid', label: 'Skip' };
    case 'manage_existing':
      return { kind: 'update_stop', label: 'Manage position' };
    case 'incomplete':
      return { kind: 'review_candidate', label: 'Review candidate' };
  }
}

// ── Headline helpers ────────────────────────────────────────────────────────

function buildHeadline(ticker: string, plainReason: string, action: DecisionAction | undefined): string {
  const firstSentenceMatch = plainReason.match(/^[^.!?]+[.!?]/);
  if (firstSentenceMatch) {
    const sentence = firstSentenceMatch[0].trim();
    if (sentence.length <= 80) {
      return sentence;
    }
  }

  if (action !== undefined) {
    return `${ticker} — ${plainActionLabel(action)}`;
  }
  return `${ticker} — Review candidate`;
}

// ── mainRisk helpers ────────────────────────────────────────────────────────

function deriveMainRisk(candidate: ScreenerCandidate): string | undefined {
  const explanationRisk = candidate.decisionSummary?.explanation?.mainRisks?.[0];
  if (explanationRisk) return explanationRisk;

  const summaryRisk = candidate.decisionSummary?.mainRisk;
  if (summaryRisk) return summaryRisk;

  const warningRisk = candidate.decisionSummary?.drivers?.warnings?.[0];
  if (warningRisk) return warningRisk;

  if (candidate.weeklyTrend === 'down') {
    return 'Weekly trend is down — consider waiting for trend to recover.';
  }

  if (!candidate.recommendation) {
    return 'Fundamental data is missing — quality cannot be fully assessed.';
  }

  return undefined;
}

// ── toBeginnerDecision ──────────────────────────────────────────────────────

/**
 * Builds a full BeginnerDecision from a ScreenerCandidate.
 */
export function toBeginnerDecision(candidate: ScreenerCandidate): BeginnerDecision {
  const readiness = toOrderReadiness(candidate);
  const quality = toSetupQuality(candidate);
  const action = candidate.decisionSummary?.action;

  // plainReason priority:
  // 1. decisionSummary.explanation?.summaryLine  (skipped if empty)
  // 2. decisionSummary.whatToDo                 (skipped if empty)
  // 3. decisionSummary.whyNow                   (skipped if empty)
  // 4. Deterministic fallback
  const plainReason =
    candidate.decisionSummary?.explanation?.summaryLine ||
    candidate.decisionSummary?.whatToDo ||
    candidate.decisionSummary?.whyNow ||
    READINESS_FALLBACK_REASON[readiness];

  const headline = buildHeadline(candidate.ticker, plainReason, action);

  const mainRisk = deriveMainRisk(candidate);

  const rawInvalidation = candidate.decisionSummary?.explanation?.whatInvalidatesIt?.[0];
  const stopValue = candidate.decisionSummary?.tradePlan?.stop;
  const invalidation =
    rawInvalidation && stopValue != null
      ? rawInvalidation.replace(/\d+\.\d{4,}/g, formatCurrency(stopValue, candidate.currency ?? 'USD'))
      : rawInvalidation;

  const { kind: nextStepKind, label: nextStepLabel } = nextStepForReadiness(readiness);

  return {
    ticker: candidate.ticker,
    setupQuality: quality,
    suggestedAction: action ?? 'WATCH',
    orderReadiness: readiness,
    headline,
    plainReason,
    mainRisk,
    invalidation,
    nextStepLabel,
    nextStepKind,
  };
}

// ── toBeginnerDecisionFromDailyCandidate ────────────────────────────────────

/**
 * Adapts a DailyReviewCandidate to a BeginnerDecision.
 * Supplies zero defaults for technical indicator fields that
 * toSetupQuality/toOrderReadiness don't rely on.
 */
export function toBeginnerDecisionFromDailyCandidate(
  candidate: import('@/features/dailyReview/types').DailyReviewCandidate
): BeginnerDecision {
  return toBeginnerDecision({
    ticker: candidate.ticker,
    close: candidate.close ?? 0,
    sma20: 0,
    sma50: 0,
    sma200: 0,
    atr: 0,
    momentum6m: 0,
    momentum12m: 0,
    relStrength: 0,
    score: candidate.score ?? 0,
    confidence: candidate.confidence ?? 0,
    rank: candidate.rank ?? 0,
    currency: candidate.currency ?? 'USD',
    recommendation: candidate.recommendation,
    decisionSummary: candidate.decisionSummary,
    weeklyTrend: undefined,
  });
}

// ── pickBestBeginnerCandidate ───────────────────────────────────────────────

/**
 * Returns the first candidate from prioritizeCandidates(candidates) that is
 * NOT 'avoid' or 'manage_existing' readiness. If none qualifies, returns the
 * first candidate overall (or undefined if empty).
 */
export function pickBestBeginnerCandidate(
  candidates: ScreenerCandidate[]
): ScreenerCandidate | undefined {
  if (candidates.length === 0) return undefined;

  const prioritized = prioritizeCandidates(candidates);

  const best = prioritized.find((c) => {
    const r = toOrderReadiness(c);
    return r !== 'avoid' && r !== 'manage_existing';
  });

  return best ?? prioritized[0];
}
