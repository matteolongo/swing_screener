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
  beginnerExplanation?: BeginnerExplanation;
  educationGenerated?: GeneratedEducationPayload;
}

export interface BeginnerExplanation {
  text: string;
  source: 'llm' | 'deterministic_fallback';
  model?: string;
  generatedAt?: string;
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
  thesis?: TradeThesisAPI;
}

// Internal API types for thesis transformation
interface InvalidationRuleAPI {
  rule_id: string;
  condition: string;
  metric?: string;
  threshold?: number;
}

interface GeneratedEducationErrorAPI {
  view: string;
  code: string;
  message: string;
  retryable: boolean;
  provider_error_id?: string;
}

interface TradePersonalityAPI {
  trend_strength: 1 | 2 | 3 | 4 | 5;
  volatility_rating: 1 | 2 | 3 | 4 | 5;
  conviction: 1 | 2 | 3 | 4 | 5;
  complexity: string;
}

interface StructuredExplanationAPI {
  why_qualified: string[];
  what_could_go_wrong: string[];
  setup_type: string;
  key_insight: string;
}

interface TradeThesisAPI {
  ticker: string;
  strategy: string;
  entry_type: string;
  trend_status: string;
  relative_strength: string;
  regime_alignment: boolean;
  volatility_state: string;
  risk_reward: number;
  setup_quality_score: number;
  setup_quality_tier: string;
  institutional_signal: boolean;
  price_action_quality: string;
  safety_label: string;
  personality: TradePersonalityAPI;
  explanation: StructuredExplanationAPI;
  invalidation_rules: InvalidationRuleAPI[];
  professional_insight?: string;
  beginner_explanation?: {
    text: string;
    source: 'llm' | 'deterministic_fallback';
    model?: string | null;
    generated_at?: string | null;
  };
  education_generated?: {
    recommendation?: unknown;
    thesis?: unknown;
    learn?: unknown;
    status?: string | null;
    source?: string | null;
    template_version?: string | null;
    deterministic_facts?: Record<string, string>;
    errors?: GeneratedEducationErrorAPI[];
    generated_at?: string | null;
  };
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

function transformThesis(apiThesis: TradeThesisAPI): TradeThesis {
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
    invalidationRules: apiThesis.invalidation_rules.map((rule: InvalidationRuleAPI) => ({
      ruleId: rule.rule_id,
      condition: rule.condition,
      metric: rule.metric,
      threshold: rule.threshold,
    })),
    professionalInsight: apiThesis.professional_insight,
    beginnerExplanation: apiThesis.beginner_explanation
      ? {
          text: apiThesis.beginner_explanation.text,
          source: apiThesis.beginner_explanation.source,
          model: apiThesis.beginner_explanation.model ?? undefined,
          generatedAt: apiThesis.beginner_explanation.generated_at ?? undefined,
        }
      : undefined,
    educationGenerated: apiEducation
      ? {
          recommendation: transformGeneratedEducationView(apiEducation.recommendation),
          thesis: transformGeneratedEducationView(apiEducation.thesis),
          learn: transformGeneratedEducationView(apiEducation.learn),
          status: (apiEducation.status ?? undefined) as GeneratedEducationPayload['status'],
          source: (apiEducation.source ?? undefined) as GeneratedEducationPayload['source'],
          templateVersion: apiEducation.template_version ?? undefined,
          deterministicFacts: apiEducation.deterministic_facts ?? {},
          errors: (apiEducation.errors ?? []).map((error: GeneratedEducationErrorAPI) => ({
            view: error.view as GeneratedEducationViewName,
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

function transformGeneratedEducationView(apiView: unknown): GeneratedEducationView | undefined {
  if (!apiView || typeof apiView !== 'object') {
    return undefined;
  }
  const view = apiView as Record<string, unknown>;
  return {
    title: String(view.title ?? ''),
    summary: String(view.summary ?? ''),
    bullets: Array.isArray(view.bullets) ? (view.bullets as unknown[]).map((value: unknown) => String(value)) : [],
    watchouts: Array.isArray(view.watchouts) ? (view.watchouts as unknown[]).map((value: unknown) => String(value)) : [],
    nextSteps: (() => {
      const raw = view.next_steps ?? view.nextSteps;
      return Array.isArray(raw) ? (raw as unknown[]).map((value: unknown) => String(value)) : [];
    })(),
    glossaryLinks: (() => {
      const raw = view.glossary_links ?? view.glossaryLinks;
      return Array.isArray(raw) ? (raw as unknown[]).map((value: unknown) => String(value)) : [];
    })(),
    factsUsed: (() => {
      const raw = view.facts_used ?? view.factsUsed;
      return Array.isArray(raw) ? (raw as unknown[]).map((value: unknown) => String(value)) : [];
    })(),
    source: view.source === 'llm' ? 'llm' : 'deterministic_fallback',
    templateVersion: String(view.template_version ?? view.templateVersion ?? 'v1'),
    generatedAt: String(view.generated_at ?? view.generatedAt ?? ''),
    debugRef: (view.debug_ref ?? view.debugRef) as string | undefined,
  };
}
