import type { FundamentalSnapshot } from '@/features/fundamentals/types';
import type {
  DecisionAction,
  DecisionCatalystLabel,
  DecisionConviction,
  DecisionDrivers,
  DecisionSignalLabel,
  DecisionSummary,
  DecisionValuationContext,
  DecisionValuationLabel,
  FairValueMethod,
  ScreenerCandidate,
} from '@/features/screener/types';

const ACTION_WHY_NOW: Record<DecisionAction, string> = {
  BUY_NOW: 'Setup timing is ready and the business-quality read supports conviction.',
  BUY_ON_PULLBACK: 'Setup quality is strong, but valuation pressure argues against chasing strength.',
  WAIT_FOR_BREAKOUT: 'Context is constructive, but the setup still needs cleaner confirmation.',
  WATCH: 'There is something to like here, but the full setup is not ready yet.',
  TACTICAL_ONLY: 'Chart conditions are tradable, but the business-quality read is weak for higher-conviction holds.',
  AVOID: 'Technical and fundamental evidence do not show a strong edge right now.',
  MANAGE_ONLY:
    'This symbol is already in play, so the priority is managing existing risk instead of adding fresh exposure.',
};

const ACTION_WHAT_TO_DO: Record<DecisionAction, string> = {
  BUY_NOW: 'Use the current trade plan and keep sizing inside your normal risk budget.',
  BUY_ON_PULLBACK: 'Prefer a disciplined pullback or very controlled breakout entry instead of chasing.',
  WAIT_FOR_BREAKOUT: 'Keep it on the active list and wait for cleaner confirmation before entry.',
  WATCH: 'Keep it on the watchlist and wait for either stronger timing or better supporting data.',
  TACTICAL_ONLY: 'Treat this as a shorter-term tactical setup and keep conviction and holding assumptions lower.',
  AVOID: 'De-prioritize this symbol until either the chart or the underlying quality improves.',
  MANAGE_ONLY: 'Manage the existing position or pending order instead of opening a new setup.',
};

const VALUATION_LEAD: Record<DecisionValuationLabel, string> = {
  cheap: 'Valuation looks reasonable on current fundamentals.',
  fair: 'Valuation looks fair on current fundamentals.',
  expensive: 'Valuation looks demanding on current fundamentals.',
  unknown: 'Valuation context is limited because current multiples are incomplete.',
};

const FAIR_VALUE_METHOD_LABELS: Record<FairValueMethod, string> = {
  earnings_multiple: 'earnings multiple',
  sales_multiple: 'sales multiple',
  book_multiple: 'book multiple',
  not_available: 'not available',
};

function average(values: Array<number | undefined>): number | undefined {
  const available = values.filter((value): value is number => value !== undefined);
  if (!available.length) {
    return undefined;
  }
  return available.reduce((sum, value) => sum + value, 0) / available.length;
}

function scoreFromStatus(status?: string): number | undefined {
  if (status === 'strong') return 1;
  if (status === 'neutral') return 0.55;
  if (status === 'weak') return 0;
  return undefined;
}

function pillarScore(snapshot: FundamentalSnapshot, key: string): number | undefined {
  const pillar = snapshot.pillars[key];
  if (!pillar) {
    return undefined;
  }
  return pillar.score ?? scoreFromStatus(pillar.status);
}

function clamp(value: number, lower: number, upper: number): number {
  return Math.max(lower, Math.min(upper, value));
}

function formatMultiple(value?: number): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return `${value.toFixed(1)}x`;
}

function formatPrice(value?: number): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value.toFixed(2);
}

function formatAbsPercent(value?: number): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return `${Math.abs(value).toFixed(1)}%`;
}

function deriveTechnicalLabel(candidate: ScreenerCandidate): DecisionSignalLabel {
  const confidence = Math.abs(candidate.confidence) <= 1 ? candidate.confidence * 100 : candidate.confidence;
  const supportiveSignals = [candidate.momentum6m, candidate.momentum12m, candidate.relStrength].filter(
    (value) => value > 0
  ).length + (candidate.signal ? 1 : 0);

  if (candidate.rr !== undefined && candidate.rr >= 2 && confidence >= 70 && supportiveSignals >= 2) {
    return 'strong';
  }
  if (candidate.rr !== undefined && candidate.rr >= 1.5) {
    return 'neutral';
  }
  if (confidence >= 55 || supportiveSignals >= 2) {
    return 'neutral';
  }
  return 'weak';
}

function deriveFundamentalsLabel(snapshot: FundamentalSnapshot): DecisionSignalLabel {
  const avg = average([
    pillarScore(snapshot, 'growth'),
    pillarScore(snapshot, 'profitability'),
    pillarScore(snapshot, 'balance_sheet'),
    pillarScore(snapshot, 'cash_flow'),
  ]);
  if (avg === undefined) return 'neutral';
  if (avg >= 0.67) return 'strong';
  if (avg >= 0.4) return 'neutral';
  return 'weak';
}

function deriveValuationLabel(snapshot: FundamentalSnapshot): DecisionValuationLabel {
  const status = snapshot.pillars.valuation?.status;
  if (status === 'strong') return 'cheap';
  if (status === 'neutral') return 'fair';
  if (status === 'weak') return 'expensive';
  return 'unknown';
}

function fairValueEstimate(
  candidate: ScreenerCandidate,
  snapshot: FundamentalSnapshot,
  trailingPe?: number,
  priceToSales?: number
): {
  method: FairValueMethod;
  fairValueLow?: number;
  fairValueBase?: number;
  fairValueHigh?: number;
  premiumDiscountPct?: number;
} {
  if (!(candidate.close > 0)) {
    return { method: 'not_available' };
  }

  const qualityScore = average([
    pillarScore(snapshot, 'growth'),
    pillarScore(snapshot, 'profitability'),
    pillarScore(snapshot, 'balance_sheet'),
    pillarScore(snapshot, 'cash_flow'),
  ]);
  const growthScore = pillarScore(snapshot, 'growth') ?? qualityScore;
  if (qualityScore === undefined || growthScore === undefined) {
    return { method: 'not_available' };
  }

  if (trailingPe !== undefined && trailingPe > 0 && trailingPe <= 80) {
    const eps = candidate.close / trailingPe;
    if (eps > 0) {
      const baseMultiple = clamp(12 + qualityScore * 12 + growthScore * 4, 10, 32);
      const lowMultiple = clamp(baseMultiple - 3, 8, baseMultiple);
      const highMultiple = clamp(baseMultiple + 3, baseMultiple, 36);
      const fairValueLow = Number((eps * lowMultiple).toFixed(2));
      const fairValueBase = Number((eps * baseMultiple).toFixed(2));
      const fairValueHigh = Number((eps * highMultiple).toFixed(2));
      const premiumDiscountPct = Number((((candidate.close - fairValueBase) / fairValueBase) * 100).toFixed(1));
      return { method: 'earnings_multiple', fairValueLow, fairValueBase, fairValueHigh, premiumDiscountPct };
    }
  }

  if (priceToSales !== undefined && priceToSales > 0 && priceToSales <= 20) {
    const revenuePerShare = candidate.close / priceToSales;
    if (revenuePerShare > 0) {
      const baseMultiple = clamp(1.5 + qualityScore * 3 + growthScore * 1.5, 1, 8);
      const lowMultiple = clamp(baseMultiple * 0.85, 0.8, baseMultiple);
      const highMultiple = clamp(baseMultiple * 1.15, baseMultiple, 10);
      const fairValueLow = Number((revenuePerShare * lowMultiple).toFixed(2));
      const fairValueBase = Number((revenuePerShare * baseMultiple).toFixed(2));
      const fairValueHigh = Number((revenuePerShare * highMultiple).toFixed(2));
      const premiumDiscountPct = Number((((candidate.close - fairValueBase) / fairValueBase) * 100).toFixed(1));
      return { method: 'sales_multiple', fairValueLow, fairValueBase, fairValueHigh, premiumDiscountPct };
    }
  }

  return { method: 'not_available' };
}

function buildValuationContext(
  candidate: ScreenerCandidate,
  snapshot: FundamentalSnapshot,
  valuationLabel: DecisionValuationLabel
): DecisionValuationContext {
  const trailingPe = snapshot.trailingPe;
  const priceToSales = snapshot.priceToSales;
  const fairValue = fairValueEstimate(candidate, snapshot, trailingPe, priceToSales);

  const detailParts: string[] = [];
  if (trailingPe !== undefined) {
    detailParts.push(`Trailing PE is ${formatMultiple(trailingPe)}`);
  }
  if (priceToSales !== undefined) {
    detailParts.push(`price-to-sales is ${formatMultiple(priceToSales)}`);
  }

  let summary = VALUATION_LEAD[valuationLabel];
  if (
    fairValue.fairValueLow !== undefined &&
    fairValue.fairValueBase !== undefined &&
    fairValue.fairValueHigh !== undefined
  ) {
    const comparison =
      (fairValue.premiumDiscountPct ?? 0) > 0
        ? 'above'
        : (fairValue.premiumDiscountPct ?? 0) < 0
          ? 'below'
          : 'in line with';
    summary = `${summary} Fair value range is ${formatPrice(fairValue.fairValueLow)} to ${formatPrice(
      fairValue.fairValueHigh
    )} using ${FAIR_VALUE_METHOD_LABELS[fairValue.method]}, and the current price is ${formatAbsPercent(
      fairValue.premiumDiscountPct
    )} ${comparison} the base fair value.`;
  }

  if (detailParts.length === 2) {
    summary = `${summary} ${detailParts[0]} and ${detailParts[1]}.`;
  } else if (detailParts.length === 1) {
    summary = `${summary} ${detailParts[0]}.`;
  }

  return {
    method: fairValue.method,
    summary,
    trailingPe,
    priceToSales,
    fairValueLow: fairValue.fairValueLow,
    fairValueBase: fairValue.fairValueBase,
    fairValueHigh: fairValue.fairValueHigh,
    premiumDiscountPct: fairValue.premiumDiscountPct,
  };
}

function deriveAction(
  technicalLabel: DecisionSignalLabel,
  fundamentalsLabel: DecisionSignalLabel,
  valuationLabel: DecisionValuationLabel,
  catalystLabel: DecisionCatalystLabel,
  sameSymbolMode?: string
): DecisionAction {
  if (sameSymbolMode === 'MANAGE_ONLY') return 'MANAGE_ONLY';
  if (technicalLabel === 'strong' && fundamentalsLabel === 'strong') {
    return valuationLabel === 'expensive' ? 'BUY_ON_PULLBACK' : 'BUY_NOW';
  }
  if (fundamentalsLabel === 'strong' && technicalLabel !== 'strong') {
    return technicalLabel === 'neutral' && catalystLabel === 'active' ? 'WAIT_FOR_BREAKOUT' : 'WATCH';
  }
  if (technicalLabel === 'strong' && fundamentalsLabel === 'weak') return 'TACTICAL_ONLY';
  if (technicalLabel === 'strong' && fundamentalsLabel === 'neutral') {
    return catalystLabel === 'active' || valuationLabel === 'expensive' ? 'WAIT_FOR_BREAKOUT' : 'WATCH';
  }
  if (technicalLabel === 'weak' && fundamentalsLabel === 'weak') return 'AVOID';
  if (technicalLabel === 'weak') {
    return catalystLabel !== 'weak' || fundamentalsLabel === 'neutral' ? 'WATCH' : 'AVOID';
  }
  return 'WATCH';
}

function deriveConviction(
  technicalLabel: DecisionSignalLabel,
  fundamentalsLabel: DecisionSignalLabel,
  valuationLabel: DecisionValuationLabel,
  catalystLabel: DecisionCatalystLabel,
  snapshot: FundamentalSnapshot,
  sameSymbolMode?: string
): DecisionConviction {
  if (sameSymbolMode === 'MANAGE_ONLY') return 'low';

  let score = 0;
  score += { strong: 2, neutral: 1, weak: 0 }[technicalLabel];
  score += { strong: 2, neutral: 1, weak: 0 }[fundamentalsLabel];
  score += { active: 1, neutral: 0.5, weak: 0 }[catalystLabel];
  score += { cheap: 0.5, fair: 0.25, expensive: -0.5, unknown: 0 }[valuationLabel];

  if (snapshot.coverageStatus === 'partial') score -= 0.5;
  if (snapshot.coverageStatus === 'insufficient' || snapshot.coverageStatus === 'unsupported') score -= 1;
  if (snapshot.freshnessStatus === 'stale') score -= 1;
  if (snapshot.dataQualityStatus === 'low') score -= 0.5;

  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

function buildDrivers(
  candidate: ScreenerCandidate,
  snapshot: FundamentalSnapshot,
  technicalLabel: DecisionSignalLabel,
  fundamentalsLabel: DecisionSignalLabel,
  valuationLabel: DecisionValuationLabel,
  catalystLabel: DecisionCatalystLabel,
  sameSymbolMode?: string
): DecisionDrivers {
  const positives: string[] = [];
  const negatives: string[] = [];
  const warnings: string[] = [];

  const push = (target: string[], value: string, limit = 2) => {
    if (!value || target.includes(value) || target.length >= limit) return;
    target.push(value);
  };

  if (technicalLabel === 'strong') push(positives, 'Technical setup is ready.');
  else if (technicalLabel === 'neutral') push(positives, 'Technical structure is constructive.');
  else push(negatives, 'Timing is not ready yet.');

  if (fundamentalsLabel === 'strong') push(positives, 'Business-quality pillars are supportive.');
  else if (fundamentalsLabel === 'weak') push(negatives, 'Business-quality pillars are weak.');

  if (valuationLabel === 'cheap') push(positives, 'Valuation looks reasonable versus current fundamentals.');
  else if (valuationLabel === 'expensive') push(negatives, 'Valuation looks demanding.');

  if (catalystLabel === 'active') push(positives, 'Recent catalyst flow keeps the symbol relevant now.');

  if (snapshot.coverageStatus === 'partial' || snapshot.coverageStatus === 'insufficient' || snapshot.coverageStatus === 'unsupported') {
    push(warnings, 'Fundamental coverage is partial.');
  }
  if (snapshot.freshnessStatus === 'stale') push(warnings, 'Fundamental snapshot is stale.');
  if (snapshot.dataQualityStatus === 'low') push(warnings, 'Fundamental data quality is limited.');

  if (candidate.rr === undefined) push(warnings, 'Reward-to-risk is not available yet.');
  else if (candidate.rr >= 2) push(positives, 'Trade plan has acceptable reward-to-risk.');
  else if (candidate.rr < 1.5) push(negatives, 'Reward-to-risk is light for a swing setup.');

  if (sameSymbolMode === 'MANAGE_ONLY') push(warnings, 'This symbol is already in an active manage-only state.');

  return { positives, negatives, warnings };
}

function mainRisk(
  snapshot: FundamentalSnapshot,
  technicalLabel: DecisionSignalLabel,
  fundamentalsLabel: DecisionSignalLabel,
  valuationLabel: DecisionValuationLabel,
  sameSymbolMode?: string
): string {
  if (sameSymbolMode === 'MANAGE_ONLY') {
    return 'A same-symbol position or order is already live, so new entry logic can create unnecessary overlap.';
  }
  if (valuationLabel === 'expensive') {
    return 'Valuation looks stretched relative to the current fundamental profile.';
  }
  if (fundamentalsLabel === 'weak') {
    return 'Business-quality pillars are weak, which reduces conviction if the trade stalls.';
  }
  if (technicalLabel === 'weak') {
    return 'Timing is not ready, so entry quality can deteriorate quickly.';
  }
  if (snapshot.freshnessStatus === 'stale') {
    return 'The fundamental snapshot is stale, so the quality read may lag the current business picture.';
  }
  return 'The trade still needs disciplined risk management because no single input guarantees follow-through.';
}

export function buildFundamentalsSummary(snapshot: FundamentalSnapshot): string | undefined {
  return snapshot.highlights[0] || snapshot.redFlags[0] || snapshot.error || undefined;
}

export function rebuildDecisionSummaryWithFundamentals(
  candidate: ScreenerCandidate,
  snapshot: FundamentalSnapshot
): DecisionSummary {
  const technicalLabel = candidate.decisionSummary?.technicalLabel ?? deriveTechnicalLabel(candidate);
  const catalystLabel = candidate.decisionSummary?.catalystLabel ?? 'weak';
  const fundamentalsLabel = deriveFundamentalsLabel(snapshot);
  const valuationLabel = deriveValuationLabel(snapshot);
  const valuationContext = buildValuationContext(candidate, snapshot, valuationLabel);
  const action = deriveAction(
    technicalLabel,
    fundamentalsLabel,
    valuationLabel,
    catalystLabel,
    candidate.sameSymbol?.mode
  );
  const conviction = deriveConviction(
    technicalLabel,
    fundamentalsLabel,
    valuationLabel,
    catalystLabel,
    snapshot,
    candidate.sameSymbol?.mode
  );
  const drivers = buildDrivers(
    candidate,
    snapshot,
    technicalLabel,
    fundamentalsLabel,
    valuationLabel,
    catalystLabel,
    candidate.sameSymbol?.mode
  );

  const whyNow =
    (action === 'WATCH' || action === 'WAIT_FOR_BREAKOUT') && catalystLabel === 'active'
      ? 'Catalyst support is active, but cleaner confirmation is still needed before acting.'
      : ACTION_WHY_NOW[action];

  return {
    symbol: candidate.ticker,
    action,
    conviction,
    technicalLabel,
    fundamentalsLabel,
    valuationLabel,
    catalystLabel,
    whyNow,
    whatToDo: ACTION_WHAT_TO_DO[action],
    mainRisk: mainRisk(snapshot, technicalLabel, fundamentalsLabel, valuationLabel, candidate.sameSymbol?.mode),
    tradePlan: {
      entry: candidate.entry,
      stop: candidate.stop,
      target: candidate.target,
      rr: candidate.rr,
    },
    valuationContext,
    drivers,
  };
}

export function syncCandidateWithFundamentals(
  candidate: ScreenerCandidate,
  snapshot: FundamentalSnapshot
): ScreenerCandidate {
  const fundamentalsSummary = buildFundamentalsSummary(snapshot);
  const decisionSummary = rebuildDecisionSummaryWithFundamentals(candidate, snapshot);
  const changed =
    candidate.fundamentalsCoverageStatus !== snapshot.coverageStatus ||
    candidate.fundamentalsFreshnessStatus !== snapshot.freshnessStatus ||
    candidate.fundamentalsSummary !== fundamentalsSummary ||
    JSON.stringify(candidate.decisionSummary ?? null) !== JSON.stringify(decisionSummary);

  if (!changed) {
    return candidate;
  }

  return {
    ...candidate,
    fundamentalsCoverageStatus: snapshot.coverageStatus,
    fundamentalsFreshnessStatus: snapshot.freshnessStatus,
    fundamentalsSummary,
    decisionSummary,
  };
}
