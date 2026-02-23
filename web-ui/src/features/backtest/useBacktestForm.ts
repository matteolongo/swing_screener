import { useCallback, useEffect, useMemo, useState } from 'react';
import { notifyManager } from '@tanstack/react-query';
import type { AppConfig } from '@/types/config';
import type { FullBacktestParams, FullEntryType } from '@/features/backtest/types';
import { t } from '@/i18n/t';

const STORAGE_KEY = 'backtest.params.v1';

export interface BacktestFormState {
  tickersText: string;
  start: string;
  end: string;
  investedBudget: number | null;
  entryType: FullEntryType;
  breakoutLookback: number;
  pullbackMa: number;
  minHistory: number;
  atrWindow: number;
  kAtr: number;
  breakevenAtR: number;
  trailAfterR: number;
  trailSma: number;
  smaBufferPct: number;
  maxHoldingDays: number;
  commissionPct: number;
}

type UseBacktestFormArgs = {
  config: AppConfig;
  strategyKAtr?: number;
};

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - 2);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function rangeYears(years: number) {
  const end = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - years);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function rangeSince(dateStr: string) {
  const end = new Date();
  return {
    start: dateStr,
    end: end.toISOString().slice(0, 10),
  };
}

function buildDefaultFormState(config: AppConfig, overrides?: { kAtr?: number }): BacktestFormState {
  const { start, end } = defaultDateRange();
  return {
    tickersText: '',
    start,
    end,
    investedBudget: null,
    entryType: 'auto',
    breakoutLookback: config.indicators.breakoutLookback,
    pullbackMa: config.indicators.pullbackMa,
    minHistory: config.indicators.minHistory,
    atrWindow: config.indicators.atrWindow,
    kAtr: overrides?.kAtr ?? config.risk.kAtr,
    breakevenAtR: config.manage.breakevenAtR,
    trailAfterR: config.manage.trailAfterR,
    trailSma: config.manage.trailSma,
    smaBufferPct: config.manage.smaBufferPct,
    maxHoldingDays: config.manage.maxHoldingDays,
    commissionPct: 0,
  };
}

function loadFormState(fallback: BacktestFormState): BacktestFormState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<BacktestFormState>;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

function parseTickers(input: string): string[] {
  return input
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter((t) => t.length > 0);
}

export function useBacktestForm({ config, strategyKAtr }: UseBacktestFormArgs) {
  const [formState, setFormState] = useState<BacktestFormState>(() => {
    const defaults = buildDefaultFormState(config, { kAtr: strategyKAtr });
    return loadFormState(defaults);
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formState));
  }, [formState]);

  const tickers = useMemo(() => parseTickers(formState.tickersText), [formState.tickersText]);
  const canRun = tickers.length > 0;

  const presets = [
    { label: t('backtestPage.parameters.presetOptions.tenYears'), range: () => rangeYears(10) },
    { label: t('backtestPage.parameters.presetOptions.fifteenYears'), range: () => rangeYears(15) },
    { label: t('backtestPage.parameters.presetOptions.since2008'), range: () => rangeSince('2008-01-01') },
  ];

  useEffect(() => {
    if (strategyKAtr == null) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    const defaults = buildDefaultFormState(config, { kAtr: strategyKAtr });
    notifyManager.schedule(() => {
      setFormState(defaults);
    });
  }, [config, strategyKAtr]);

  const resetToStrategyDefaults = useCallback(() => {
    const defaults = buildDefaultFormState(config, { kAtr: strategyKAtr });
    setFormState((prev) => ({
      ...prev,
      entryType: defaults.entryType,
      breakoutLookback: defaults.breakoutLookback,
      pullbackMa: defaults.pullbackMa,
      minHistory: defaults.minHistory,
      atrWindow: defaults.atrWindow,
      kAtr: defaults.kAtr,
      breakevenAtR: defaults.breakevenAtR,
      trailAfterR: defaults.trailAfterR,
      trailSma: defaults.trailSma,
      smaBufferPct: defaults.smaBufferPct,
      maxHoldingDays: defaults.maxHoldingDays,
      commissionPct: defaults.commissionPct,
    }));
  }, [config, strategyKAtr]);

  const buildRunParams = useCallback(
    (): FullBacktestParams => ({
      tickers,
      start: formState.start,
      end: formState.end,
      investedBudget: formState.investedBudget && formState.investedBudget > 0 ? formState.investedBudget : undefined,
      entryType: formState.entryType,
      breakoutLookback: formState.breakoutLookback,
      pullbackMa: formState.pullbackMa,
      minHistory: formState.minHistory,
      atrWindow: formState.atrWindow,
      kAtr: formState.kAtr,
      breakevenAtR: formState.breakevenAtR,
      trailAfterR: formState.trailAfterR,
      trailSma: formState.trailSma,
      smaBufferPct: formState.smaBufferPct,
      maxHoldingDays: formState.maxHoldingDays,
      commissionPct: formState.commissionPct,
    }),
    [formState, tickers],
  );

  return {
    formState,
    setFormState,
    tickers,
    canRun,
    presets,
    resetToStrategyDefaults,
    buildRunParams,
  };
}
