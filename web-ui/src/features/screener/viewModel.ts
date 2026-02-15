// View model helpers for Screener candidates
// Centralizes fallback logic for recommendation vs candidate data

import { ScreenerCandidate } from './types';

export interface CandidateViewModel {
  ticker: string;
  currency: 'USD' | 'EUR';
  name: string;
  sector: string;
  lastBar: string;
  close: number;
  confidence: number;
  rank: number;
  verdict: 'RECOMMENDED' | 'NOT_RECOMMENDED' | 'UNKNOWN';
  
  // Setup fields (with fallback logic)
  entry: number | null;
  stop: number | null;
  rr: number | null;
  riskUsd: number | null;
  
  // Advanced metrics
  score: number;
  atr: number;
  momentum6m: number;
  momentum12m: number;
  relStrength: number;
  
  // Overlay data
  overlayStatus: string;
  overlayReasons: string[];
  overlayRiskMultiplier: number | null;
  overlayMaxPosMultiplier: number | null;
  overlayAttentionZ: number | null;
  overlaySentimentScore: number | null;
  overlaySentimentConfidence: number | null;
  overlayHypeScore: number | null;
  overlaySampleSize: number | null;
  
  // Fix recommendations
  fixes: string[];
  
  // Original candidate (for modals)
  original: ScreenerCandidate;
}

/**
 * Normalize a screener candidate into a view model with consistent fallback logic
 */
export function toCandidateViewModel(candidate: ScreenerCandidate): CandidateViewModel {
  // Verdict: use recommendation verdict or fallback to UNKNOWN
  const verdict = candidate.recommendation?.verdict ?? 'UNKNOWN';
  
  // Setup values: prefer recommendation.risk fields over candidate direct fields
  const entry = candidate.entry ?? null;
  const stop = candidate.recommendation?.risk?.stop ?? candidate.stop ?? null;
  const rr = candidate.recommendation?.risk?.rr ?? candidate.rr ?? null;
  const riskUsd = candidate.recommendation?.risk?.riskAmount ?? candidate.riskUsd ?? null;
  
  // Fix recommendations
  const fixes = candidate.recommendation?.education?.whatWouldMakeValid ?? [];
  
  // Overlay data
  const overlayStatus = candidate.overlayStatus ?? 'OFF';
  const overlayReasons = candidate.overlayReasons ?? [];
  
  return {
    ticker: candidate.ticker,
    currency: candidate.currency,
    name: candidate.name ?? 'Unknown',
    sector: candidate.sector ?? 'Unknown',
    lastBar: candidate.lastBar ?? '-',
    close: candidate.close,
    confidence: candidate.confidence,
    rank: candidate.rank,
    verdict,
    
    // Setup with fallbacks
    entry,
    stop,
    rr,
    riskUsd,
    
    // Advanced metrics
    score: candidate.score,
    atr: candidate.atr,
    momentum6m: candidate.momentum6m,
    momentum12m: candidate.momentum12m,
    relStrength: candidate.relStrength,
    
    // Overlay
    overlayStatus,
    overlayReasons,
    overlayRiskMultiplier: candidate.overlayRiskMultiplier ?? null,
    overlayMaxPosMultiplier: candidate.overlayMaxPosMultiplier ?? null,
    overlayAttentionZ: candidate.overlayAttentionZ ?? null,
    overlaySentimentScore: candidate.overlaySentimentScore ?? null,
    overlaySentimentConfidence: candidate.overlaySentimentConfidence ?? null,
    overlayHypeScore: candidate.overlayHypeScore ?? null,
    overlaySampleSize: candidate.overlaySampleSize ?? null,
    
    // Fix list
    fixes,
    
    // Original for modals
    original: candidate,
  };
}

/**
 * Check if a candidate is recommended for trading
 */
export function isRecommended(vm: CandidateViewModel): boolean {
  return vm.verdict === 'RECOMMENDED';
}

/**
 * Check if candidate has any fixes to show
 */
export function hasFixes(vm: CandidateViewModel): boolean {
  return vm.fixes.length > 0;
}

/**
 * Check if candidate has overlay data
 */
export function hasOverlayData(vm: CandidateViewModel): boolean {
  return vm.overlayStatus !== 'OFF' && vm.overlayReasons.length > 0;
}
