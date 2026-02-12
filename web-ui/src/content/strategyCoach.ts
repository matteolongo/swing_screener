import { AppConfig } from '@/types/config';
import { Strategy } from '@/types/strategy';

export interface StrategyCoachSection {
  title: string;
  explanation: string;
  formula?: string;
  example?: string;
}

const asPercent = (ratio: number, decimals: number = 1): string => `${(ratio * 100).toFixed(decimals)}%`;

export function buildStrategyCoachSections(strategy: Strategy): StrategyCoachSection[] {
  const currencyScope = strategy.universe.filt.currencies.join(' + ');
  return [
    {
      title: 'What this strategy tries to do',
      explanation:
        `It searches for strong trend followers and keeps risk fixed so one bad trade stays small. ` +
        `It ranks candidates, keeps the top ${strategy.ranking.topN}, and avoids weak risk/reward setups.`,
    },
    {
      title: 'How symbols are filtered',
      explanation:
        `Universe filters keep symbols between ${strategy.universe.filt.minPrice} and ${strategy.universe.filt.maxPrice}, ` +
        `in ${currencyScope}, and under ${strategy.universe.filt.maxAtrPct}% ATR/price.`,
      formula:
        `Trend: close > SMA(${strategy.universe.trend.smaFast}), SMA(${strategy.universe.trend.smaMid}), SMA(${strategy.universe.trend.smaLong})`,
      example:
        `Momentum windows use ${strategy.universe.mom.lookback6m} bars (6M) and ${strategy.universe.mom.lookback12m} bars (12M) vs ${strategy.universe.mom.benchmark}.`,
    },
    {
      title: 'How entries and stops are formed',
      explanation:
        `Entries come from breakout/pullback signal rules, then stop distance is anchored to volatility.`,
      formula:
        `Stop = Entry - (${strategy.risk.kAtr.toFixed(1)} x ATR(${strategy.universe.vol.atrWindow}))`,
      example:
        `If Entry is 50.00 and ATR is 1.20, stop is about ${(50 - strategy.risk.kAtr * 1.2).toFixed(2)}.`,
    },
    {
      title: 'How position sizing works',
      explanation:
        'Position size is chosen from a fixed risk budget, then capped by max position size and minimum shares.',
      formula: `Risk Amount = Account Size x Risk % = ${strategy.risk.accountSize} x ${asPercent(strategy.risk.riskPct, 2)}`,
      example:
        `Per-trade budget is about ${(strategy.risk.accountSize * strategy.risk.riskPct).toFixed(2)} with max position ${asPercent(strategy.risk.maxPositionPct)}.`,
    },
    {
      title: 'What makes a trade Recommended',
      explanation:
        'Recommendation must pass checklist gates, not just have a high score or confidence.',
      formula:
        `Requires RR >= ${strategy.risk.minRr.toFixed(1)} and Fee/Risk <= ${asPercent(strategy.risk.maxFeeRiskPct)}`,
      example:
        'A setup with great momentum can still be blocked if stop is invalid, RR is low, or costs are too high.',
    },
    {
      title: 'How open positions are managed',
      explanation:
        'Once trade progress reaches specific R levels, stop logic shifts from protection to trend trailing.',
      formula:
        `Breakeven at +${strategy.manage.breakevenAtR.toFixed(1)}R, trail after +${strategy.manage.trailAfterR.toFixed(1)}R using SMA(${strategy.manage.trailSma})`,
      example:
        `Trailing stop uses a ${asPercent(strategy.manage.smaBufferPct, 2)} buffer under the trailing SMA.`,
    },
    {
      title: 'What social overlay means',
      explanation:
        strategy.socialOverlay.enabled
          ? `Overlay is ON. It reviews social extremes and can reduce size or veto a trade when hype/risk is abnormal.`
          : 'Overlay is OFF. Recommendations rely only on price/volume/risk rules.',
      formula: strategy.socialOverlay.enabled
        ? `Triggers include Attention Z >= ${strategy.socialOverlay.attentionZThreshold} and sample >= ${strategy.socialOverlay.minSampleSize}`
        : undefined,
    },
  ];
}

export function buildFallbackStrategyCoachSections(config: AppConfig): StrategyCoachSection[] {
  return [
    {
      title: 'What this strategy tries to do',
      explanation:
        'This fallback explanation uses your local Settings values because active strategy details were unavailable.',
    },
    {
      title: 'How symbols are filtered',
      explanation:
        `Trend uses SMA(${config.indicators.smaFast}/${config.indicators.smaMid}/${config.indicators.smaLong}) with ` +
        `momentum windows ${config.indicators.lookback6m} and ${config.indicators.lookback12m}.`,
    },
    {
      title: 'How entries and stops are formed',
      explanation: 'Stops are volatility-based and tied to ATR.',
      formula: `Stop = Entry - (${config.risk.kAtr.toFixed(1)} x ATR(${config.indicators.atrWindow}))`,
    },
    {
      title: 'How position sizing works',
      explanation: 'Each trade uses a fixed risk budget from account size.',
      formula: `Risk Amount = ${config.risk.accountSize} x ${asPercent(config.risk.riskPct, 2)}`,
    },
    {
      title: 'What makes a trade Recommended',
      explanation:
        `A trade must meet minimum RR (${config.risk.minRr.toFixed(1)}) and cost-to-risk cap (${asPercent(config.risk.maxFeeRiskPct)}).`,
    },
    {
      title: 'How open positions are managed',
      explanation:
        `Move to breakeven at +${config.manage.breakevenAtR.toFixed(1)}R, trail after +${config.manage.trailAfterR.toFixed(1)}R with SMA(${config.manage.trailSma}).`,
      formula: `Trailing buffer = ${asPercent(config.manage.smaBufferPct, 2)}`,
    },
  ];
}
