export type RecommendationVerdict = 'RECOMMENDED' | 'NOT_RECOMMENDED';
export type RecommendationSeverity = 'info' | 'warn' | 'block';

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
  };
}
