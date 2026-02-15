/**
 * Type definitions for strategy documentation schema
 * This provides structured educational content for strategy parameters
 */

export interface StrategyInfo {
  id: string;
  name: string;
  philosophy: string;
  idealFor: string;
  holdingPeriod: string;
  coreRule: string;
}

export interface ParameterTradeoffs {
  lower?: string;
  higher?: string;
  looseFilter?: string;
  strictFilter?: string;
  recentHeavy?: string;
  longTermHeavy?: string;
  earlier?: string;
  later?: string;
  enabled?: string;
  disabled?: string;
}

export interface ParameterDocumentation {
  parameter: string;
  category: 'signals' | 'trend' | 'volatility' | 'risk' | 'management' | 'ranking' | 'confirmation';
  whatItIs: string;
  whyItMatters: string;
  howItAffectsTrades: string;
  tradeoffs: ParameterTradeoffs;
  beginnerRange: string;
  defaultGuidance: string;
  dangerZone: string;
  proTip: string;
  highlight?: boolean;
}

export interface StrategyDocumentation {
  strategy: StrategyInfo;
  parameters: Record<string, ParameterDocumentation>;
}

export interface SafetyEvaluation {
  score: number; // 0-100
  level: 'beginner-safe' | 'requires-discipline' | 'expert-only';
  warnings: string[];
}
