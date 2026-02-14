import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import type { Dispatch, SetStateAction } from 'react';
import { t } from '@/i18n/t';
import {
  CheckboxInput,
  HelpInfo,
  NumberInput,
  SelectInput,
  TextInput,
} from '@/components/domain/strategy/StrategyFieldControls';
import {
  Strategy,
  StrategyEntryType,
  StrategyExitMode,
} from '@/features/strategy/types';

interface StrategyAdvancedSettingsCardProps {
  draft: Strategy;
  setDraft: (value: Strategy) => void;
  showAdvanced: boolean;
  setShowAdvanced: Dispatch<SetStateAction<boolean>>;
  lowRrWarning: boolean;
  highFeeWarning: boolean;
  help: Record<string, HelpInfo>;
}

export default function StrategyAdvancedSettingsCard({
  draft,
  setDraft,
  showAdvanced,
  setShowAdvanced,
  lowRrWarning,
  highFeeWarning,
  help,
}: StrategyAdvancedSettingsCardProps) {
  const backtestEntryOptions = [
    { value: 'auto', label: t('strategyPage.advanced.options.entryAuto') },
    { value: 'breakout', label: t('strategyPage.advanced.options.entryBreakout') },
    { value: 'pullback', label: t('strategyPage.advanced.options.entryPullback') },
  ];

  const backtestExitOptions = [
    { value: 'trailing_stop', label: t('strategyPage.advanced.options.exitTrailingStop') },
    { value: 'take_profit', label: t('strategyPage.advanced.options.exitTakeProfit') },
  ];

  return (
    <Card variant="bordered">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{t('strategyPage.advanced.title')}</span>
          <Button variant="secondary" onClick={() => setShowAdvanced((prev) => !prev)}>
            {showAdvanced
              ? t('strategyPage.advanced.actions.hide')
              : t('strategyPage.advanced.actions.show')}
          </Button>
        </CardTitle>
      </CardHeader>
      {showAdvanced && (
        <CardContent>
          <div className="space-y-6">
            <div>
              <div className="text-sm font-semibold mb-3">{t('strategyPage.advanced.sections.trend')}</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <NumberInput
                  label={t('strategyPage.advanced.fields.smaFast')}
                  value={draft.universe.trend.smaFast}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      universe: {
                        ...draft.universe,
                        trend: { ...draft.universe.trend, smaFast: value },
                      },
                    })
                  }
                  step={1}
                  min={1}
                  help={help.smaFast}
                />
                <NumberInput
                  label={t('strategyPage.advanced.fields.smaMid')}
                  value={draft.universe.trend.smaMid}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      universe: {
                        ...draft.universe,
                        trend: { ...draft.universe.trend, smaMid: value },
                      },
                    })
                  }
                  step={1}
                  min={1}
                  help={help.smaMid}
                />
                <NumberInput
                  label={t('strategyPage.advanced.fields.smaLong')}
                  value={draft.universe.trend.smaLong}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      universe: {
                        ...draft.universe,
                        trend: { ...draft.universe.trend, smaLong: value },
                      },
                    })
                  }
                  step={1}
                  min={1}
                  help={help.smaLong}
                />
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-3">{t('strategyPage.advanced.sections.volatility')}</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <NumberInput
                  label={t('strategyPage.advanced.fields.atrWindow')}
                  value={draft.universe.vol.atrWindow}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      universe: {
                        ...draft.universe,
                        vol: { ...draft.universe.vol, atrWindow: value },
                      },
                    })
                  }
                  step={1}
                  min={1}
                  help={help.atrWindow}
                />
                <NumberInput
                  label={t('strategyPage.advanced.fields.maxAtrPct')}
                  value={draft.universe.filt.maxAtrPct}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      universe: {
                        ...draft.universe,
                        filt: { ...draft.universe.filt, maxAtrPct: value },
                      },
                    })
                  }
                  step={0.5}
                  min={0}
                  suffix="%"
                  help={help.maxAtrPct}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-4">
                <CheckboxInput
                  label={t('strategyPage.advanced.fields.requireTrendOk')}
                  checked={draft.universe.filt.requireTrendOk}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      universe: {
                        ...draft.universe,
                        filt: { ...draft.universe.filt, requireTrendOk: value },
                      },
                    })
                  }
                  help={help.requireTrendOk}
                />
                <CheckboxInput
                  label={t('strategyPage.advanced.fields.requireRsPositive')}
                  checked={draft.universe.filt.requireRsPositive}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      universe: {
                        ...draft.universe,
                        filt: { ...draft.universe.filt, requireRsPositive: value },
                      },
                    })
                  }
                  help={help.requireRsPositive}
                />
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-3">{t('strategyPage.advanced.sections.momentum')}</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <NumberInput
                  label={t('strategyPage.advanced.fields.lookback6m')}
                  value={draft.universe.mom.lookback6m}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      universe: {
                        ...draft.universe,
                        mom: { ...draft.universe.mom, lookback6m: value },
                      },
                    })
                  }
                  step={1}
                  min={1}
                  help={help.momentum6m}
                />
                <NumberInput
                  label={t('strategyPage.advanced.fields.lookback12m')}
                  value={draft.universe.mom.lookback12m}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      universe: {
                        ...draft.universe,
                        mom: { ...draft.universe.mom, lookback12m: value },
                      },
                    })
                  }
                  step={1}
                  min={1}
                  help={help.momentum12m}
                />
                <TextInput
                  label={t('strategyPage.advanced.fields.benchmark')}
                  value={draft.universe.mom.benchmark}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      universe: {
                        ...draft.universe,
                        mom: { ...draft.universe.mom, benchmark: value.toUpperCase() },
                      },
                    })
                  }
                  help={help.benchmark}
                />
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-3">
                {t('strategyPage.advanced.sections.rankingWeights')}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <NumberInput
                  label={t('strategyPage.advanced.fields.weight6m')}
                  value={draft.ranking.wMom6m}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      ranking: { ...draft.ranking, wMom6m: value },
                    })
                  }
                  step={0.05}
                  min={0}
                  help={help.weightMom6m}
                />
                <NumberInput
                  label={t('strategyPage.advanced.fields.weight12m')}
                  value={draft.ranking.wMom12m}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      ranking: { ...draft.ranking, wMom12m: value },
                    })
                  }
                  step={0.05}
                  min={0}
                  help={help.weightMom12m}
                />
                <NumberInput
                  label={t('strategyPage.advanced.fields.weightRs')}
                  value={draft.ranking.wRs6m}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      ranking: { ...draft.ranking, wRs6m: value },
                    })
                  }
                  step={0.05}
                  min={0}
                  help={help.weightRs}
                />
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-3">{t('strategyPage.advanced.sections.riskDetails')}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <NumberInput
                  label={t('strategyPage.advanced.fields.minShares')}
                  value={draft.risk.minShares}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      risk: { ...draft.risk, minShares: value },
                    })
                  }
                  step={1}
                  min={1}
                />
                <NumberInput
                  label={t('strategyPage.advanced.fields.minimumRr')}
                  value={draft.risk.minRr}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      risk: { ...draft.risk, minRr: value },
                    })
                  }
                  step={0.1}
                  min={0.5}
                  help={help.minRr}
                />
                <NumberInput
                  label={t('strategyPage.advanced.fields.maxFeeRisk')}
                  value={draft.risk.maxFeeRiskPct * 100}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      risk: { ...draft.risk, maxFeeRiskPct: value / 100 },
                    })
                  }
                  step={1}
                  min={0}
                  max={100}
                  suffix="%"
                  help={help.maxFeeRiskPct}
                />
              </div>
              {(lowRrWarning || highFeeWarning) && (
                <div className="mt-3 rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                  <div className="font-semibold">{t('strategyPage.advanced.guardrails.title')}</div>
                  {lowRrWarning && (
                    <div>{t('strategyPage.advanced.guardrails.lowRr')}</div>
                  )}
                  {highFeeWarning && (
                    <div>{t('strategyPage.advanced.guardrails.highFee')}</div>
                  )}
                </div>
              )}
              <div className="mt-6">
                <div className="text-sm font-semibold mb-3">
                  {t('strategyPage.advanced.sections.regimeRiskScaling')}
                </div>
                <div className="space-y-4">
                  <CheckboxInput
                    label={t('strategyPage.advanced.fields.enableRegimeScaling')}
                    checked={draft.risk.regimeEnabled}
                    onChange={(value) =>
                      setDraft({
                        ...draft,
                        risk: { ...draft.risk, regimeEnabled: value },
                      })
                    }
                    help={help.regimeEnabled}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <NumberInput
                      label={t('strategyPage.advanced.fields.trendSma')}
                      value={draft.risk.regimeTrendSma}
                      onChange={(value) =>
                        setDraft({
                          ...draft,
                          risk: { ...draft.risk, regimeTrendSma: value },
                        })
                      }
                      step={1}
                      min={50}
                      help={help.regimeTrendSma}
                    />
                    <NumberInput
                      label={t('strategyPage.advanced.fields.trendMultiplier')}
                      value={draft.risk.regimeTrendMultiplier}
                      onChange={(value) =>
                        setDraft({
                          ...draft,
                          risk: { ...draft.risk, regimeTrendMultiplier: value },
                        })
                      }
                      step={0.05}
                      min={0}
                      max={1}
                      help={help.regimeTrendMultiplier}
                    />
                    <NumberInput
                      label={t('strategyPage.advanced.fields.volatilityAtrWindow')}
                      value={draft.risk.regimeVolAtrWindow}
                      onChange={(value) =>
                        setDraft({
                          ...draft,
                          risk: { ...draft.risk, regimeVolAtrWindow: value },
                        })
                      }
                      step={1}
                      min={2}
                      help={help.regimeVolAtrWindow}
                    />
                    <NumberInput
                      label={t('strategyPage.advanced.fields.volatilityAtrPctThreshold')}
                      value={draft.risk.regimeVolAtrPctThreshold}
                      onChange={(value) =>
                        setDraft({
                          ...draft,
                          risk: { ...draft.risk, regimeVolAtrPctThreshold: value },
                        })
                      }
                      step={0.1}
                      min={0}
                      help={help.regimeVolAtrPctThreshold}
                    />
                    <NumberInput
                      label={t('strategyPage.advanced.fields.volatilityMultiplier')}
                      value={draft.risk.regimeVolMultiplier}
                      onChange={(value) =>
                        setDraft({
                          ...draft,
                          risk: { ...draft.risk, regimeVolMultiplier: value },
                        })
                      }
                      step={0.05}
                      min={0}
                      max={1}
                      help={help.regimeVolMultiplier}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-3">{t('strategyPage.advanced.sections.manageRules')}</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <NumberInput
                  label={t('strategyPage.advanced.fields.breakevenAtR')}
                  value={draft.manage.breakevenAtR}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      manage: { ...draft.manage, breakevenAtR: value },
                    })
                  }
                  step={0.1}
                  min={0}
                />
                <NumberInput
                  label={t('strategyPage.advanced.fields.trailAfterR')}
                  value={draft.manage.trailAfterR}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      manage: { ...draft.manage, trailAfterR: value },
                    })
                  }
                  step={0.1}
                  min={0}
                />
                <NumberInput
                  label={t('strategyPage.advanced.fields.trailSma')}
                  value={draft.manage.trailSma}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      manage: { ...draft.manage, trailSma: value },
                    })
                  }
                  step={1}
                  min={1}
                  help={help.trailSma}
                />
                <NumberInput
                  label={t('strategyPage.advanced.fields.smaBuffer')}
                  value={draft.manage.smaBufferPct * 100}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      manage: { ...draft.manage, smaBufferPct: value / 100 },
                    })
                  }
                  step={0.1}
                  min={0}
                  suffix="%"
                  help={help.smaBuffer}
                />
                <NumberInput
                  label={t('strategyPage.advanced.fields.maxHoldingDays')}
                  value={draft.manage.maxHoldingDays}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      manage: { ...draft.manage, maxHoldingDays: value },
                    })
                  }
                  step={1}
                  min={1}
                />
                <TextInput
                  label={t('strategyPage.advanced.fields.benchmark')}
                  value={draft.manage.benchmark}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      manage: { ...draft.manage, benchmark: value.toUpperCase() },
                    })
                  }
                />
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-3">
                {t('strategyPage.advanced.sections.backtestDefaults')}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SelectInput
                  label={t('strategyPage.advanced.fields.entryType')}
                  value={draft.backtest.entryType}
                  options={backtestEntryOptions}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      backtest: { ...draft.backtest, entryType: value as StrategyEntryType },
                    })
                  }
                />
                <SelectInput
                  label={t('strategyPage.advanced.fields.exitMode')}
                  value={draft.backtest.exitMode}
                  options={backtestExitOptions}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      backtest: { ...draft.backtest, exitMode: value as StrategyExitMode },
                    })
                  }
                />
                <NumberInput
                  label={t('strategyPage.advanced.fields.takeProfitR')}
                  value={draft.backtest.takeProfitR}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      backtest: { ...draft.backtest, takeProfitR: value },
                    })
                  }
                  step={0.1}
                  min={0}
                />
                <NumberInput
                  label={t('strategyPage.advanced.fields.maxHoldingDays')}
                  value={draft.backtest.maxHoldingDays}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      backtest: { ...draft.backtest, maxHoldingDays: value },
                    })
                  }
                  step={1}
                  min={1}
                />
                <NumberInput
                  label={t('strategyPage.advanced.fields.breakevenAtR')}
                  value={draft.backtest.breakevenAtR}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      backtest: { ...draft.backtest, breakevenAtR: value },
                    })
                  }
                  step={0.1}
                  min={0}
                />
                <NumberInput
                  label={t('strategyPage.advanced.fields.trailAfterR')}
                  value={draft.backtest.trailAfterR}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      backtest: { ...draft.backtest, trailAfterR: value },
                    })
                  }
                  step={0.1}
                  min={0}
                />
                <NumberInput
                  label={t('strategyPage.advanced.fields.trailSma')}
                  value={draft.backtest.trailSma}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      backtest: { ...draft.backtest, trailSma: value },
                    })
                  }
                  step={1}
                  min={1}
                  help={help.trailSma}
                />
                <NumberInput
                  label={t('strategyPage.advanced.fields.smaBuffer')}
                  value={draft.backtest.smaBufferPct * 100}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      backtest: { ...draft.backtest, smaBufferPct: value / 100 },
                    })
                  }
                  step={0.1}
                  min={0}
                  suffix="%"
                  help={help.smaBuffer}
                />
                <NumberInput
                  label={t('strategyPage.advanced.fields.commission')}
                  value={draft.backtest.commissionPct * 100}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      backtest: { ...draft.backtest, commissionPct: value / 100 },
                    })
                  }
                  step={0.05}
                  min={0}
                  suffix="%"
                />
                <NumberInput
                  label={t('strategyPage.advanced.fields.minHistory')}
                  value={draft.backtest.minHistory}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      backtest: { ...draft.backtest, minHistory: value },
                    })
                  }
                  step={1}
                  min={1}
                />
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
