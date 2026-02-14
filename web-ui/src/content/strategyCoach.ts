import { AppConfig } from '@/types/config';
import { Strategy } from '@/features/strategy/types';
import { t } from '@/i18n/t';

export interface StrategyCoachSection {
  title: string;
  explanation: string;
  formula?: string;
  example?: string;
}

const asPercent = (ratio: number, decimals: number = 1): string => `${(ratio * 100).toFixed(decimals)}%`;

export function buildStrategyCoachSections(strategy: Strategy): StrategyCoachSection[] {
  const currencyScope = strategy.universe.filt.currencies.join(' + ');
  const stopExample = (50 - strategy.risk.kAtr * 1.2).toFixed(2);
  const riskBudget = (strategy.risk.accountSize * strategy.risk.riskPct).toFixed(2);
  return [
    {
      title: t('strategyCoach.sections.goal.title'),
      explanation: t('strategyCoach.sections.goal.explanation', {
        topN: strategy.ranking.topN,
      }),
    },
    {
      title: t('strategyCoach.sections.filters.title'),
      explanation: t('strategyCoach.sections.filters.explanation', {
        minPrice: strategy.universe.filt.minPrice,
        maxPrice: strategy.universe.filt.maxPrice,
        currencyScope,
        maxAtrPct: strategy.universe.filt.maxAtrPct,
      }),
      formula: t('strategyCoach.sections.filters.formula', {
        smaFast: strategy.universe.trend.smaFast,
        smaMid: strategy.universe.trend.smaMid,
        smaLong: strategy.universe.trend.smaLong,
      }),
      example: t('strategyCoach.sections.filters.example', {
        lookback6m: strategy.universe.mom.lookback6m,
        lookback12m: strategy.universe.mom.lookback12m,
        benchmark: strategy.universe.mom.benchmark,
      }),
    },
    {
      title: t('strategyCoach.sections.entries.title'),
      explanation: t('strategyCoach.sections.entries.explanation'),
      formula: t('strategyCoach.sections.entries.formula', {
        kAtr: strategy.risk.kAtr.toFixed(1),
        atrWindow: strategy.universe.vol.atrWindow,
      }),
      example: t('strategyCoach.sections.entries.example', { stop: stopExample }),
    },
    {
      title: t('strategyCoach.sections.sizing.title'),
      explanation: t('strategyCoach.sections.sizing.explanation'),
      formula: t('strategyCoach.sections.sizing.formula', {
        accountSize: strategy.risk.accountSize,
        riskPct: asPercent(strategy.risk.riskPct, 2),
      }),
      example: t('strategyCoach.sections.sizing.example', {
        budget: riskBudget,
        maxPositionPct: asPercent(strategy.risk.maxPositionPct),
      }),
    },
    {
      title: t('strategyCoach.sections.recommended.title'),
      explanation: t('strategyCoach.sections.recommended.explanation'),
      formula: t('strategyCoach.sections.recommended.formula', {
        minRr: strategy.risk.minRr.toFixed(1),
        maxFeeRiskPct: asPercent(strategy.risk.maxFeeRiskPct),
      }),
      example: t('strategyCoach.sections.recommended.example'),
    },
    {
      title: t('strategyCoach.sections.manage.title'),
      explanation: t('strategyCoach.sections.manage.explanation'),
      formula: t('strategyCoach.sections.manage.formula', {
        breakevenAtR: strategy.manage.breakevenAtR.toFixed(1),
        trailAfterR: strategy.manage.trailAfterR.toFixed(1),
        trailSma: strategy.manage.trailSma,
      }),
      example: t('strategyCoach.sections.manage.example', {
        smaBufferPct: asPercent(strategy.manage.smaBufferPct, 2),
      }),
    },
    {
      title: t('strategyCoach.sections.overlay.title'),
      explanation: strategy.socialOverlay.enabled
        ? t('strategyCoach.sections.overlay.enabledExplanation')
        : t('strategyCoach.sections.overlay.disabledExplanation'),
      formula: strategy.socialOverlay.enabled
        ? t('strategyCoach.sections.overlay.formula', {
          attentionZThreshold: strategy.socialOverlay.attentionZThreshold,
          minSampleSize: strategy.socialOverlay.minSampleSize,
        })
        : undefined,
    },
  ];
}

export function buildFallbackStrategyCoachSections(config: AppConfig): StrategyCoachSection[] {
  return [
    {
      title: t('strategyCoach.fallback.goal.title'),
      explanation: t('strategyCoach.fallback.goal.explanation'),
    },
    {
      title: t('strategyCoach.fallback.filters.title'),
      explanation: t('strategyCoach.fallback.filters.explanation', {
        smaFast: config.indicators.smaFast,
        smaMid: config.indicators.smaMid,
        smaLong: config.indicators.smaLong,
        lookback6m: config.indicators.lookback6m,
        lookback12m: config.indicators.lookback12m,
      }),
    },
    {
      title: t('strategyCoach.fallback.entries.title'),
      explanation: t('strategyCoach.fallback.entries.explanation'),
      formula: t('strategyCoach.fallback.entries.formula', {
        kAtr: config.risk.kAtr.toFixed(1),
        atrWindow: config.indicators.atrWindow,
      }),
    },
    {
      title: t('strategyCoach.fallback.sizing.title'),
      explanation: t('strategyCoach.fallback.sizing.explanation'),
      formula: t('strategyCoach.fallback.sizing.formula', {
        accountSize: config.risk.accountSize,
        riskPct: asPercent(config.risk.riskPct, 2),
      }),
    },
    {
      title: t('strategyCoach.fallback.recommended.title'),
      explanation: t('strategyCoach.fallback.recommended.explanation', {
        minRr: config.risk.minRr.toFixed(1),
        maxFeeRiskPct: asPercent(config.risk.maxFeeRiskPct),
      }),
    },
    {
      title: t('strategyCoach.fallback.manage.title'),
      explanation: t('strategyCoach.fallback.manage.explanation', {
        breakevenAtR: config.manage.breakevenAtR.toFixed(1),
        trailAfterR: config.manage.trailAfterR.toFixed(1),
        trailSma: config.manage.trailSma,
      }),
      formula: t('strategyCoach.fallback.manage.formula', {
        smaBufferPct: asPercent(config.manage.smaBufferPct, 2),
      }),
    },
  ];
}
