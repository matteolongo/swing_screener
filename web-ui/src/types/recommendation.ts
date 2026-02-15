export type RecommendationVerdict = 'RECOMMENDED' | 'NOT_RECOMMENDED';
export type RecommendationSeverity = 'info' | 'warn' | 'block';

// Trade Thesis types
export type SafetyLabel = 'BEGINNER_FRIENDLY' | 'REQUIRES_DISCIPLINE' | 'ADVANCED_ONLY';
export type SetupQuality = 'INSTITUTIONAL' | 'HIGH_QUALITY' | 'TRADABLE' | 'WEAK';

export interface TradePersonality {
  trendStrength: 1 | 2 | 3 | 4 | 5;
  volatilityRating: 1 | 2 | 3 | 4 | 5;
  conviction: 1 | 2 | 3 | 4 | 5;
  complexity: string;
}

export interface InvalidationRule {
  ruleId: string;
  condition: string;
  metric?: string;
  threshold?: number;
}

export interface StructuredExplanation {
  whyQualified: string[];
  whatCouldGoWrong: string[];
  setupType: string;
  keyInsight: string;
}

export interface TradeThesis {
  ticker: string;
  strategy: string;
  entryType: string;
  trendStatus: string;
  relativeStrength: string;
  regimeAlignment: boolean;
  volatilityState: string;
  riskReward: number;
  setupQualityScore: number;
  setupQualityTier: SetupQuality;
  institutionalSignal: boolean;
  priceActionQuality: string;
  safetyLabel: SafetyLabel;
  personality: TradePersonality;
  explanation: StructuredExplanation;
  invalidationRules: InvalidationRule[];
  professionalInsight?: string;
}

export interface RecommendationReason {
  code: string;
  message: string;
  severity: RecommendationSeverity;
  rule?: string;
  metrics: Record<string, number | string>;
}

export interface RecommendationRisk {
  entry: number;
  stop?: number;
  target?: number;
  rr?: number;
  riskAmount: number;
  riskPct: number;
  positionSize: number;
  shares: number;
  invalidationLevel?: number;
}

export interface RecommendationCosts {
  commissionEstimate: number;
  fxEstimate: number;
  slippageEstimate: number;
  totalCost: number;
  feeToRiskPct?: number;
}

export interface ChecklistGate {
  gateName: string;
  passed: boolean;
  explanation: string;
  rule?: string;
}

export interface RecommendationEducation {
  commonBiasWarning: string;
  whatToLearn: string;
  whatWouldMakeValid: string[];
}

export interface Recommendation {
  verdict: RecommendationVerdict;
  reasonsShort: string[];
  reasonsDetailed: RecommendationReason[];
  risk: RecommendationRisk;
  costs: RecommendationCosts;
  checklist: ChecklistGate[];
  education: RecommendationEducation;
  thesis?: TradeThesis;
}

// API shapes (snake_case)
export interface RecommendationReasonAPI {
  code: string;
  message: string;
  severity: RecommendationSeverity;
  rule?: string;
  metrics: Record<string, number | string>;
}

export interface RecommendationRiskAPI {
  entry: number;
  stop?: number | null;
  target?: number | null;
  rr?: number | null;
  risk_amount: number;
  risk_pct: number;
  position_size: number;
  shares: number;
  invalidation_level?: number | null;
}

export interface RecommendationCostsAPI {
  commission_estimate: number;
  fx_estimate: number;
  slippage_estimate: number;
  total_cost: number;
  fee_to_risk_pct?: number | null;
}

export interface ChecklistGateAPI {
  gate_name: string;
  passed: boolean;
  explanation: string;
  rule?: string;
}

export interface RecommendationEducationAPI {
  common_bias_warning: string;
  what_to_learn: string;
  what_would_make_valid: string[];
}

export interface RecommendationAPI {
  verdict: RecommendationVerdict;
  reasons_short: string[];
  reasons_detailed: RecommendationReasonAPI[];
  risk: RecommendationRiskAPI;
  costs: RecommendationCostsAPI;
  checklist: ChecklistGateAPI[];
  education: RecommendationEducationAPI;
  thesis?: any;  // Thesis comes as dict from backend
}

export function transformRecommendation(api: RecommendationAPI): Recommendation {
  return {
    verdict: api.verdict,
    reasonsShort: api.reasons_short,
    reasonsDetailed: api.reasons_detailed.map((r) => ({
      code: r.code,
      message: r.message,
      severity: r.severity,
      rule: r.rule,
      metrics: r.metrics ?? {},
    })),
    risk: {
      entry: api.risk.entry,
      stop: api.risk.stop ?? undefined,
      target: api.risk.target ?? undefined,
      rr: api.risk.rr ?? undefined,
      riskAmount: api.risk.risk_amount,
      riskPct: api.risk.risk_pct,
      positionSize: api.risk.position_size,
      shares: api.risk.shares,
      invalidationLevel: api.risk.invalidation_level ?? undefined,
    },
    costs: {
      commissionEstimate: api.costs.commission_estimate,
      fxEstimate: api.costs.fx_estimate,
      slippageEstimate: api.costs.slippage_estimate,
      totalCost: api.costs.total_cost,
      feeToRiskPct: api.costs.fee_to_risk_pct ?? undefined,
    },
    checklist: api.checklist.map((g) => ({
      gateName: g.gate_name,
      passed: g.passed,
      explanation: g.explanation,
      rule: g.rule,
    })),
    education: {
      commonBiasWarning: api.education.common_bias_warning,
      whatToLearn: api.education.what_to_learn,
      whatWouldMakeValid: api.education.what_would_make_valid ?? [],
    },
    thesis: api.thesis ? transformThesis(api.thesis) : undefined,
  };
}

function transformThesis(apiThesis: any): TradeThesis {
  return {
    ticker: apiThesis.ticker,
    strategy: apiThesis.strategy,
    entryType: apiThesis.entry_type,
    trendStatus: apiThesis.trend_status,
    relativeStrength: apiThesis.relative_strength,
    regimeAlignment: apiThesis.regime_alignment,
    volatilityState: apiThesis.volatility_state,
    riskReward: apiThesis.risk_reward,
    setupQualityScore: apiThesis.setup_quality_score,
    setupQualityTier: apiThesis.setup_quality_tier as SetupQuality,
    institutionalSignal: apiThesis.institutional_signal,
    priceActionQuality: apiThesis.price_action_quality,
    safetyLabel: apiThesis.safety_label as SafetyLabel,
    personality: {
      trendStrength: apiThesis.personality.trend_strength,
      volatilityRating: apiThesis.personality.volatility_rating,
      conviction: apiThesis.personality.conviction,
      complexity: apiThesis.personality.complexity,
    },
    explanation: {
      whyQualified: apiThesis.explanation.why_qualified,
      whatCouldGoWrong: apiThesis.explanation.what_could_go_wrong,
      setupType: apiThesis.explanation.setup_type,
      keyInsight: apiThesis.explanation.key_insight,
    },
    invalidationRules: apiThesis.invalidation_rules.map((rule: any) => ({
      ruleId: rule.rule_id,
      condition: rule.condition,
      metric: rule.metric,
      threshold: rule.threshold,
    })),
    professionalInsight: apiThesis.professional_insight,
  };
}
