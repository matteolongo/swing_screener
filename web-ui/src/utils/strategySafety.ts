/**
 * Parameter safety evaluation utilities
 * Analyzes strategy configuration and provides behavioral warnings
 */
import type { Strategy } from '@/features/strategy/types';

export interface ParameterWarning {
  parameter: string;
  level: 'warning' | 'danger' | 'info';
  message: string;
}

/**
 * Evaluate breakout lookback parameter
 */
function evaluateBreakoutLookback(value: number): ParameterWarning | null {
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

/**
 * Evaluate minimum risk/reward parameter
 */
function evaluateMinimumRR(value: number): ParameterWarning | null {
  if (value < 1.5) {
    return {
      parameter: 'minimumRr',
      level: 'danger',
      message: 'Minimum R/R under 1.5 makes profitability statistically harder. Consider raising to 2 or higher.',
    };
  }
  if (value < 2) {
    return {
      parameter: 'minimumRr',
      level: 'warning',
      message: 'R/R below 2 requires a higher win rate to be profitable. Most professionals target 2:1 or better.',
    };
  }
  return null;
}

/**
 * Evaluate ATR percentage parameter
 */
function evaluateMaxAtrPct(value: number): ParameterWarning | null {
  if (value > 25) {
    return {
      parameter: 'maxAtrPct',
      level: 'danger',
      message: 'Max ATR above 25% indicates extremely volatile stocks — beginners often struggle managing risk at this level.',
    };
  }
  if (value > 18) {
    return {
      parameter: 'maxAtrPct',
      level: 'warning',
      message: 'Higher volatility means larger stop distances and more emotional pressure. Ensure your risk management is solid.',
    };
  }
  return null;
}

/**
 * Evaluate pullback MA parameter
 */
function evaluatePullbackMa(value: number): ParameterWarning | null {
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

/**
 * Evaluate max holding days parameter
 */
function evaluateMaxHoldingDays(value: number): ParameterWarning | null {
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

/**
 * Evaluate risk per trade parameter
 */
function evaluateRiskPerTrade(value: number): ParameterWarning | null {
  if (value > 3) {
    return {
      parameter: 'riskPerTrade',
      level: 'danger',
      message: 'Risking more than 3% per trade significantly increases the risk of large drawdowns.',
    };
  }
  if (value > 2) {
    return {
      parameter: 'riskPerTrade',
      level: 'warning',
      message: 'Most professional traders risk 1-2% per trade. Higher risk requires perfect execution.',
    };
  }
  return null;
}

/**
 * Evaluate all parameters in a strategy and return warnings
 */
export function evaluateStrategy(strategy: Strategy): ParameterWarning[] {
  const warnings: ParameterWarning[] = [];

  // Signals
  const breakoutWarning = evaluateBreakoutLookback(strategy.signals.breakoutLookback);
  if (breakoutWarning) warnings.push(breakoutWarning);

  const pullbackWarning = evaluatePullbackMa(strategy.signals.pullbackMa);
  if (pullbackWarning) warnings.push(pullbackWarning);

  // Risk
  const rrWarning = evaluateMinimumRR(strategy.risk.minRr);
  if (rrWarning) warnings.push(rrWarning);

  const riskWarning = evaluateRiskPerTrade(strategy.risk.riskPct * 100);
  if (riskWarning) warnings.push(riskWarning);

  // Volatility
  // maxAtrPct is already stored in percent points (e.g., 15 means 15%).
  const atrWarning = evaluateMaxAtrPct(strategy.universe.filt.maxAtrPct);
  if (atrWarning) warnings.push(atrWarning);

  // Management
  const holdingWarning = evaluateMaxHoldingDays(strategy.manage.maxHoldingDays);
  if (holdingWarning) warnings.push(holdingWarning);

  return warnings;
}

/**
 * Calculate a safety score for the strategy (0-100)
 */
export function calculateSafetyScore(strategy: Strategy): number {
  let score = 100;
  const warnings = evaluateStrategy(strategy);

  // Deduct points based on warning severity
  for (const warning of warnings) {
    if (warning.level === 'danger') {
      score -= 15;
    } else if (warning.level === 'warning') {
      score -= 8;
    } else if (warning.level === 'info') {
      score -= 3;
    }
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Get safety level based on score
 */
export function getSafetyLevel(score: number): 'beginner-safe' | 'requires-discipline' | 'expert-only' {
  if (score >= 85) return 'beginner-safe';
  if (score >= 70) return 'requires-discipline';
  return 'expert-only';
}
