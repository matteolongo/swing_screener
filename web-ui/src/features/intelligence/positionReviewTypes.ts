export type PositionReviewMode = 'position' | 'symbol';
export type PositionReviewAction = 'HOLD' | 'TRIM' | 'EXIT' | 'RAISE_STOP' | 'WATCH';
export type PositionReviewThesisStatus = 'intact' | 'weakening' | 'broken' | 'unclear';
export type MoveExtension = 'low' | 'medium' | 'high' | 'unknown';
export type TrimAdvice = 'none' | 'trim_25_percent' | 'trim_33_percent' | 'trim_50_percent' | 'exit';
export type StopMethod = 'keep' | 'breakeven' | 'trail_sma20' | 'trail_recent_low' | 'manual_review';
export type MacroRiskLevel = 'low' | 'medium' | 'high' | 'unknown';
export type TechnicalReliability = 'normal' | 'reduced' | 'unreliable' | 'unknown';
export type AffectedTimeframe = 'intraday' | 'days' | 'weeks' | 'unknown';

export interface MoveExplanationAPI {
  summary: string;
  company_catalyst_weight: number;
  sector_weight: number;
  market_macro_weight: number;
  technical_weight: number;
  drivers: string[];
}

export interface ProfitProtectionAPI {
  current_r: number | null;
  move_extension: MoveExtension;
  trim_advice: TrimAdvice;
  reason: string;
}

export interface StopAdviceAPI {
  current_stop: number | null;
  suggested_stop: number | null;
  method: StopMethod;
  reason: string;
}

export interface MacroOverlayAPI {
  risk_level: MacroRiskLevel;
  technical_reliability: TechnicalReliability;
  reason: string;
  affected_timeframe: AffectedTimeframe;
}

export interface ReviewEvidenceAPI {
  label: string;
  source: string | null;
  url: string | null;
  date: string | null;
  summary: string | null;
  relevance: string | null;
}

export interface PositionReviewAPI {
  ticker: string;
  generated_at: string;
  mode: PositionReviewMode;
  suggested_action: PositionReviewAction;
  thesis_status: PositionReviewThesisStatus;
  move_explanation: MoveExplanationAPI;
  profit_protection: ProfitProtectionAPI;
  stop_advice: StopAdviceAPI;
  macro_overlay: MacroOverlayAPI;
  evidence_used: ReviewEvidenceAPI[];
  narrative: string;
}

export interface MoveExplanation {
  summary: string;
  companyCatalystWeight: number;
  sectorWeight: number;
  marketMacroWeight: number;
  technicalWeight: number;
  drivers: string[];
}

export interface ProfitProtection {
  currentR: number | null;
  moveExtension: MoveExtension;
  trimAdvice: TrimAdvice;
  reason: string;
}

export interface StopAdvice {
  currentStop: number | null;
  suggestedStop: number | null;
  method: StopMethod;
  reason: string;
}

export interface MacroOverlay {
  riskLevel: MacroRiskLevel;
  technicalReliability: TechnicalReliability;
  reason: string;
  affectedTimeframe: AffectedTimeframe;
}

export interface ReviewEvidence {
  label: string;
  source: string | null;
  url: string | null;
  date: string | null;
  summary: string | null;
  relevance: string | null;
}

export interface PositionReview {
  ticker: string;
  generatedAt: string;
  mode: PositionReviewMode;
  suggestedAction: PositionReviewAction;
  thesisStatus: PositionReviewThesisStatus;
  moveExplanation: MoveExplanation;
  profitProtection: ProfitProtection;
  stopAdvice: StopAdvice;
  macroOverlay: MacroOverlay;
  evidenceUsed: ReviewEvidence[];
  narrative: string;
}

export function transformPositionReview(api: PositionReviewAPI): PositionReview {
  return {
    ticker: api.ticker,
    generatedAt: api.generated_at,
    mode: api.mode,
    suggestedAction: api.suggested_action,
    thesisStatus: api.thesis_status,
    moveExplanation: {
      summary: api.move_explanation.summary,
      companyCatalystWeight: api.move_explanation.company_catalyst_weight,
      sectorWeight: api.move_explanation.sector_weight,
      marketMacroWeight: api.move_explanation.market_macro_weight,
      technicalWeight: api.move_explanation.technical_weight,
      drivers: api.move_explanation.drivers ?? [],
    },
    profitProtection: {
      currentR: api.profit_protection.current_r,
      moveExtension: api.profit_protection.move_extension,
      trimAdvice: api.profit_protection.trim_advice,
      reason: api.profit_protection.reason,
    },
    stopAdvice: {
      currentStop: api.stop_advice.current_stop,
      suggestedStop: api.stop_advice.suggested_stop,
      method: api.stop_advice.method,
      reason: api.stop_advice.reason,
    },
    macroOverlay: {
      riskLevel: api.macro_overlay.risk_level,
      technicalReliability: api.macro_overlay.technical_reliability,
      reason: api.macro_overlay.reason,
      affectedTimeframe: api.macro_overlay.affected_timeframe,
    },
    evidenceUsed: api.evidence_used ?? [],
    narrative: api.narrative,
  };
}
