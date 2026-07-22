export type RecommendationVerdict = 'RECOMMENDED' | 'NOT_RECOMMENDED';
export type RecommendationSeverity = 'info' | 'warn' | 'block';
export type DecisionGateStatus = 'PASS' | 'WAIT' | 'BLOCK' | 'UNKNOWN';
export type WorkflowStatus = 'ready' | 'waiting_trigger' | 'needs_review' | 'no_setup';
export type NextStepCode =
  | 'review_order'
  | 'wait_pullback'
  | 'wait_breakout_close'
  | 'define_target'
  | 'refresh_data'
  | 'fix_stop'
  | 'inspect_gate_conflict'
  | 'observe';

export interface WorkflowNextStep {
  code: NextStepCode;
  triggerPrice?: number;
  currency?: string;
}

export interface WorkflowNextStepAPI {
  code: NextStepCode;
  trigger_price?: number | null;
  currency?: string | null;
}

export interface DecisionGate {
  status: DecisionGateStatus;
  explanation: string;
}

export interface DecisionGateState {
  setup: DecisionGate;
  trigger: DecisionGate;
  plan: DecisionGate;
  portfolio: DecisionGate;
  readyToOrder: boolean;
}

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
  educationGenerated?: GeneratedEducationPayload;
}

export type GeneratedEducationViewName = 'recommendation' | 'thesis' | 'learn';
export type GeneratedEducationRequestSource = 'llm' | 'deterministic_fallback' | 'cache';

export interface GeneratedEducationError {
  view: GeneratedEducationViewName;
  code: string;
  message: string;
  retryable: boolean;
  providerErrorId?: string;
}

export interface GeneratedEducationView {
  title: string;
  summary: string;
  bullets: string[];
  watchouts: string[];
  nextSteps: string[];
  glossaryLinks: string[];
  factsUsed: string[];
  source: 'llm' | 'deterministic_fallback';
  templateVersion: string;
  generatedAt: string;
  debugRef?: string;
}

export interface GeneratedEducationPayload {
  recommendation?: GeneratedEducationView;
  thesis?: GeneratedEducationView;
  learn?: GeneratedEducationView;
  status?: 'ok' | 'partial' | 'error';
  source?: GeneratedEducationRequestSource;
  templateVersion?: string;
  deterministicFacts: Record<string, string>;
  errors: GeneratedEducationError[];
  generatedAt?: string;
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
  desiredTarget?: number;
  targetSource?: string;
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
  decisionGates?: DecisionGateState;
  education: RecommendationEducation;
  workflowStatus: WorkflowStatus;
  nextStep: WorkflowNextStep;
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
  desired_target?: number | null;
  target_source?: string;
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
  decision_gates?: {
    setup: DecisionGate;
    trigger: DecisionGate;
    plan: DecisionGate;
    portfolio: DecisionGate;
    ready_to_order: boolean;
  };
  education: RecommendationEducationAPI;
  workflow_status?: WorkflowStatus;
  next_step?: WorkflowNextStepAPI;
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
      desiredTarget: api.risk.desired_target ?? undefined,
      targetSource: api.risk.target_source ?? 'unvalidated_r_multiple',
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
    decisionGates: api.decision_gates ? {
      setup: api.decision_gates.setup,
      trigger: api.decision_gates.trigger,
      plan: api.decision_gates.plan,
      portfolio: api.decision_gates.portfolio,
      readyToOrder: api.decision_gates.ready_to_order,
    } : undefined,
    education: {
      commonBiasWarning: api.education.common_bias_warning,
      whatToLearn: api.education.what_to_learn,
      whatWouldMakeValid: api.education.what_would_make_valid ?? [],
    },
    workflowStatus: api.workflow_status ?? 'needs_review',
    nextStep: api.next_step
      ? {
          code: api.next_step.code,
          triggerPrice: api.next_step.trigger_price ?? undefined,
          currency: api.next_step.currency ?? undefined,
        }
      : { code: 'refresh_data' },
    thesis: api.thesis ? transformThesis(api.thesis) : undefined,
  };
}

function transformThesis(apiThesis: any): TradeThesis {
  const apiEducation = apiThesis.education_generated;
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
    educationGenerated: apiEducation
      ? {
          recommendation: transformGeneratedEducationView(apiEducation.recommendation),
          thesis: transformGeneratedEducationView(apiEducation.thesis),
          learn: transformGeneratedEducationView(apiEducation.learn),
          status: apiEducation.status ?? undefined,
          source: apiEducation.source ?? undefined,
          templateVersion: apiEducation.template_version ?? undefined,
          deterministicFacts: apiEducation.deterministic_facts ?? {},
          errors: (apiEducation.errors ?? []).map((error: any) => ({
            view: error.view,
            code: error.code,
            message: error.message,
            retryable: Boolean(error.retryable),
            providerErrorId: error.provider_error_id ?? undefined,
          })),
          generatedAt: apiEducation.generated_at ?? undefined,
        }
      : undefined,
  };
}

function transformGeneratedEducationView(apiView: any): GeneratedEducationView | undefined {
  if (!apiView || typeof apiView !== 'object') {
    return undefined;
  }
  return {
    title: String(apiView.title ?? ''),
    summary: String(apiView.summary ?? ''),
    bullets: Array.isArray(apiView.bullets) ? apiView.bullets.map((value: unknown) => String(value)) : [],
    watchouts: Array.isArray(apiView.watchouts) ? apiView.watchouts.map((value: unknown) => String(value)) : [],
    nextSteps: Array.isArray(apiView.next_steps ?? apiView.nextSteps)
      ? (apiView.next_steps ?? apiView.nextSteps).map((value: unknown) => String(value))
      : [],
    glossaryLinks: Array.isArray(apiView.glossary_links ?? apiView.glossaryLinks)
      ? (apiView.glossary_links ?? apiView.glossaryLinks).map((value: unknown) => String(value))
      : [],
    factsUsed: Array.isArray(apiView.facts_used ?? apiView.factsUsed)
      ? (apiView.facts_used ?? apiView.factsUsed).map((value: unknown) => String(value))
      : [],
    source: apiView.source === 'llm' ? 'llm' : 'deterministic_fallback',
    templateVersion: String(apiView.template_version ?? apiView.templateVersion ?? 'v1'),
    generatedAt: String(apiView.generated_at ?? apiView.generatedAt ?? ''),
    debugRef: apiView.debug_ref ?? apiView.debugRef ?? undefined,
  };
}
