export type StrategicStage = 'watching' | 'emerging' | 'active' | 'fading';
export type StrategicActionType =
  | 'REVIEW_CONTEXT'
  | 'WAIT_FOR_CONFIRMATION'
  | 'TIGHTEN_RISK_REVIEW'
  | 'REDUCE_EXPOSURE_REVIEW';
export type StrategicDirection = 'bullish' | 'bearish' | 'mixed' | 'neutral';
export type StrategicConfidence = 'low' | 'medium' | 'high';

export interface StrategicPredictionAPI {
  direction: StrategicDirection;
  horizon_days: number;
  thesis: string;
  confidence: StrategicConfidence;
  invalidation: string;
}

export interface StrategicActionAPI {
  action_type: StrategicActionType;
  title: string;
  rationale: string;
  symbols: string[];
}

export interface StrategicSituationAPI {
  title: string;
  stage: StrategicStage;
  why_now: string[];
  mechanisms: string[];
  affected_symbols: string[];
  predictions: StrategicPredictionAPI[];
  actions: StrategicActionAPI[];
}

export interface StrategicReviewAPI {
  generated_at: string;
  input_policy: 'app_context_only';
  external_source_count: number;
  situations: StrategicSituationAPI[];
  memo: string;
}

export interface StrategicPrediction {
  direction: StrategicDirection;
  horizonDays: number;
  thesis: string;
  confidence: StrategicConfidence;
  invalidation: string;
}

export interface StrategicAction {
  actionType: StrategicActionType;
  title: string;
  rationale: string;
  symbols: string[];
}

export interface StrategicSituation {
  title: string;
  stage: StrategicStage;
  whyNow: string[];
  mechanisms: string[];
  affectedSymbols: string[];
  predictions: StrategicPrediction[];
  actions: StrategicAction[];
}

export interface StrategicReview {
  generatedAt: string;
  inputPolicy: 'app_context_only';
  externalSourceCount: number;
  situations: StrategicSituation[];
  memo: string;
}

export function transformStrategicReview(api: StrategicReviewAPI): StrategicReview {
  return {
    generatedAt: api.generated_at,
    inputPolicy: api.input_policy,
    externalSourceCount: api.external_source_count,
    memo: api.memo,
    situations: (api.situations ?? []).map((situation) => ({
      title: situation.title,
      stage: situation.stage,
      whyNow: situation.why_now ?? [],
      mechanisms: situation.mechanisms ?? [],
      affectedSymbols: situation.affected_symbols ?? [],
      predictions: (situation.predictions ?? []).map((prediction) => ({
        direction: prediction.direction,
        horizonDays: prediction.horizon_days,
        thesis: prediction.thesis,
        confidence: prediction.confidence,
        invalidation: prediction.invalidation,
      })),
      actions: (situation.actions ?? []).map((action) => ({
        actionType: action.action_type,
        title: action.title,
        rationale: action.rationale,
        symbols: action.symbols ?? [],
      })),
    })),
  };
}
