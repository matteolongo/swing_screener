import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import type { Dispatch, SetStateAction } from 'react';
import {
  CheckboxInput,
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
  help: Record<string, any>;
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
  return (
    <Card variant="bordered">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Advanced Settings</span>
          <Button variant="secondary" onClick={() => setShowAdvanced((prev) => !prev)}>
            {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
          </Button>
        </CardTitle>
      </CardHeader>
      {showAdvanced && (
        <CardContent>
          <div className="space-y-6">
            <div>
              <div className="text-sm font-semibold mb-3">Trend (SMA)</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <NumberInput
                  label="SMA Fast"
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
                  label="SMA Mid"
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
                  label="SMA Long"
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
              <div className="text-sm font-semibold mb-3">Volatility</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <NumberInput
                  label="ATR Window"
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
                  label="Max ATR %"
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
                  label="Require Trend OK"
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
                  label="Require RS Positive"
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
              <div className="text-sm font-semibold mb-3">Momentum</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <NumberInput
                  label="Lookback 6m"
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
                  label="Lookback 12m"
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
                  label="Benchmark"
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
              <div className="text-sm font-semibold mb-3">Ranking Weights</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <NumberInput
                  label="Weight 6m"
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
                  label="Weight 12m"
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
                  label="Weight RS"
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
              <div className="text-sm font-semibold mb-3">Risk Details</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <NumberInput
                  label="Min Shares"
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
                  label="Minimum RR"
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
                  label="Max Fee / Risk"
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
                  <div className="font-semibold">Recommendation guardrails</div>
                  {lowRrWarning && (
                    <div>Minimum RR below 1.5 may allow low-payoff setups.</div>
                  )}
                  {highFeeWarning && (
                    <div>Max fee/risk above 30% increases fee drag risk.</div>
                  )}
                </div>
              )}
              <div className="mt-6">
                <div className="text-sm font-semibold mb-3">Regime Risk Scaling</div>
                <div className="space-y-4">
                  <CheckboxInput
                    label="Enable Regime Scaling"
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
                      label="Trend SMA"
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
                      label="Trend Multiplier"
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
                      label="Volatility ATR Window"
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
                      label="Volatility ATR % Threshold"
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
                      label="Volatility Multiplier"
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
              <div className="text-sm font-semibold mb-3">Manage Rules</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <NumberInput
                  label="Breakeven At R"
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
                  label="Trail After R"
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
                  label="Trail SMA"
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
                  label="SMA Buffer"
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
                  label="Max Holding Days"
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
                  label="Benchmark"
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
              <div className="text-sm font-semibold mb-3">Backtest Defaults</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SelectInput
                  label="Entry Type"
                  value={draft.backtest.entryType}
                  options={[
                    { value: 'auto', label: 'Auto' },
                    { value: 'breakout', label: 'Breakout' },
                    { value: 'pullback', label: 'Pullback' },
                  ]}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      backtest: { ...draft.backtest, entryType: value as StrategyEntryType },
                    })
                  }
                />
                <SelectInput
                  label="Exit Mode"
                  value={draft.backtest.exitMode}
                  options={[
                    { value: 'trailing_stop', label: 'Trailing Stop' },
                    { value: 'take_profit', label: 'Take Profit' },
                  ]}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      backtest: { ...draft.backtest, exitMode: value as StrategyExitMode },
                    })
                  }
                />
                <NumberInput
                  label="Take Profit (R)"
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
                  label="Max Holding Days"
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
                  label="Breakeven At R"
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
                  label="Trail After R"
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
                  label="Trail SMA"
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
                  label="SMA Buffer"
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
                  label="Commission"
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
                  label="Min History"
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
