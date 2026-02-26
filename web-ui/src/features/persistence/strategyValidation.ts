import type { StrategyUpdateRequestAPI } from '@/features/strategy/types';

export interface LocalValidationWarning {
  parameter: string;
  level: 'danger' | 'warning' | 'info';
  message: string;
}

export interface LocalStrategyValidationResult {
  isValid: boolean;
  warnings: LocalValidationWarning[];
  safetyScore: number;
  safetyLevel: 'beginner-safe' | 'requires-discipline' | 'expert-only';
  totalWarnings: number;
  dangerCount: number;
  warningCount: number;
  infoCount: number;
}

function evaluateBreakoutLookback(value: number): LocalValidationWarning | null {
  if (value < 20) {
    return {
      parameter: 'breakoutLookback',
      level: 'danger',
      message: 'Breakout Lookback below 20 behaves more like day trading than swing trading.',
    };
  }
  if (value < 40) {
    return {
      parameter: 'breakoutLookback',
      level: 'warning',
      message: 'Lower lookback periods increase signal frequency but may include more false breakouts.',
    };
  }
  return null;
}

function evaluatePullbackMa(value: number): LocalValidationWarning | null {
  if (value < 10) {
    return {
      parameter: 'pullbackMa',
      level: 'warning',
      message: 'Very short pullback periods may lead to entries on minor retracements that fail.',
    };
  }
  if (value > 50) {
    return {
      parameter: 'pullbackMa',
      level: 'info',
      message: 'Longer pullback periods are more conservative but may miss faster-moving opportunities.',
    };
  }
  return null;
}

function evaluateMinimumRr(value: number): LocalValidationWarning | null {
  if (value < 1.5) {
    return {
      parameter: 'minimumRr',
      level: 'danger',
      message:
        'Minimum R/R under 1.5 makes profitability statistically harder. Consider raising to 2 or higher.',
    };
  }
  if (value < 2.0) {
    return {
      parameter: 'minimumRr',
      level: 'warning',
      message: 'R/R below 2 requires a higher win rate to be profitable. Most professionals target 2:1 or better.',
    };
  }
  return null;
}

function evaluateRiskPerTrade(valuePct: number): LocalValidationWarning | null {
  if (valuePct > 3) {
    return {
      parameter: 'riskPerTrade',
      level: 'danger',
      message: 'Risking more than 3% per trade significantly increases the risk of large drawdowns.',
    };
  }
  if (valuePct > 2) {
    return {
      parameter: 'riskPerTrade',
      level: 'warning',
      message: 'Most professional traders risk 1-2% per trade. Higher risk requires perfect execution.',
    };
  }
  return null;
}

function evaluateMaxAtrPct(value: number): LocalValidationWarning | null {
  if (value > 25) {
    return {
      parameter: 'maxAtrPct',
      level: 'danger',
      message:
        'Max ATR above 25% indicates extremely volatile stocks - beginners often struggle managing risk at this level.',
    };
  }
  if (value > 18) {
    return {
      parameter: 'maxAtrPct',
      level: 'warning',
      message:
        'Higher volatility means larger stop distances and more emotional pressure. Ensure your risk management is solid.',
    };
  }
  return null;
}

function evaluateMaxHoldingDays(value: number): LocalValidationWarning | null {
  if (value < 5) {
    return {
      parameter: 'maxHoldingDays',
      level: 'warning',
      message: 'Very short holding periods may not give momentum enough time to develop.',
    };
  }
  if (value > 30) {
    return {
      parameter: 'maxHoldingDays',
      level: 'info',
      message: 'Longer holding periods can tie up capital in stagnant trades. Monitor performance closely.',
    };
  }
  return null;
}

function calculateSafetyScore(warnings: LocalValidationWarning[]): number {
  let score = 100;
  warnings.forEach((warning) => {
    if (warning.level === 'danger') {
      score -= 15;
      return;
    }
    if (warning.level === 'warning') {
      score -= 8;
      return;
    }
    score -= 3;
  });
  return Math.max(0, Math.min(100, score));
}

function resolveSafetyLevel(score: number): LocalStrategyValidationResult['safetyLevel'] {
  if (score >= 85) return 'beginner-safe';
  if (score >= 70) return 'requires-discipline';
  return 'expert-only';
}

export function validateStrategyLocally(payload: StrategyUpdateRequestAPI): LocalStrategyValidationResult {
  const warnings: LocalValidationWarning[] = [];

  const breakoutLookback = Number(payload.signals?.breakout_lookback);
  if (Number.isFinite(breakoutLookback)) {
    const warning = evaluateBreakoutLookback(breakoutLookback);
    if (warning) warnings.push(warning);
  }

  const pullbackMa = Number(payload.signals?.pullback_ma);
  if (Number.isFinite(pullbackMa)) {
    const warning = evaluatePullbackMa(pullbackMa);
    if (warning) warnings.push(warning);
  }

  const minRr = Number(payload.risk?.min_rr);
  if (Number.isFinite(minRr)) {
    const warning = evaluateMinimumRr(minRr);
    if (warning) warnings.push(warning);
  }

  const riskPct = Number(payload.risk?.risk_pct);
  if (Number.isFinite(riskPct)) {
    const warning = evaluateRiskPerTrade(riskPct * 100);
    if (warning) warnings.push(warning);
  }

  const maxAtrPct = Number(payload.universe?.filt?.max_atr_pct);
  if (Number.isFinite(maxAtrPct)) {
    const warning = evaluateMaxAtrPct(maxAtrPct);
    if (warning) warnings.push(warning);
  }

  const maxHoldingDays = Number(payload.manage?.max_holding_days);
  if (Number.isFinite(maxHoldingDays)) {
    const warning = evaluateMaxHoldingDays(maxHoldingDays);
    if (warning) warnings.push(warning);
  }

  const dangerCount = warnings.filter((warning) => warning.level === 'danger').length;
  const warningCount = warnings.filter((warning) => warning.level === 'warning').length;
  const infoCount = warnings.filter((warning) => warning.level === 'info').length;
  const safetyScore = calculateSafetyScore(warnings);

  return {
    isValid: dangerCount === 0,
    warnings,
    safetyScore,
    safetyLevel: resolveSafetyLevel(safetyScore),
    totalWarnings: warnings.length,
    dangerCount,
    warningCount,
    infoCount,
  };
}
