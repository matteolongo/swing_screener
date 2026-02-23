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
  const intelligenceUniverseScopeOptions = [
    {
      value: 'screener_universe',
      label: t('strategyPage.advanced.options.intelligenceUniverseScreener'),
    },
    {
      value: 'strategy_universe',
      label: t('strategyPage.advanced.options.intelligenceUniverseStrategy'),
    },
  ];
  const intelligenceLlmProviderOptions = [
    { value: 'openai', label: t('strategyPage.advanced.options.intelligenceLlmProviderOpenai') },
    {
      value: 'anthropic',
      label: t('strategyPage.advanced.options.intelligenceLlmProviderAnthropic'),
    },
    { value: 'ollama', label: t('strategyPage.advanced.options.intelligenceLlmProviderOllama') },
    { value: 'mock', label: t('strategyPage.advanced.options.intelligenceLlmProviderMock') },
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

            <div>
              <div className="text-sm font-semibold mb-3">
                {t('strategyPage.advanced.sections.marketIntelligence')}
              </div>
              <div className="space-y-6">
                <div className="space-y-3">
                  <CheckboxInput
                    label={t('strategyPage.advanced.fields.intelligenceEnabled')}
                    checked={draft.marketIntelligence.enabled}
                    onChange={(value) =>
                      setDraft({
                        ...draft,
                        marketIntelligence: { ...draft.marketIntelligence, enabled: value },
                      })
                    }
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SelectInput
                      label={t('strategyPage.advanced.fields.intelligenceUniverseScope')}
                      value={draft.marketIntelligence.universeScope}
                      options={intelligenceUniverseScopeOptions}
                      onChange={(value) =>
                        setDraft({
                          ...draft,
                          marketIntelligence: {
                            ...draft.marketIntelligence,
                            universeScope: value as 'screener_universe' | 'strategy_universe',
                          },
                        })
                      }
                    />
                    <TextInput
                      label={t('strategyPage.advanced.fields.intelligenceMarketContextSymbols')}
                      value={draft.marketIntelligence.marketContextSymbols.join(', ')}
                      onChange={(value) => {
                        const symbols = value
                          .split(',')
                          .map((item) => item.trim().toUpperCase())
                          .filter((item, index, list) => item.length > 0 && list.indexOf(item) === index);
                        setDraft({
                          ...draft,
                          marketIntelligence: {
                            ...draft.marketIntelligence,
                            marketContextSymbols: symbols,
                          },
                        });
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <CheckboxInput
                      label={t('strategyPage.advanced.fields.intelligenceProviderYahoo')}
                      checked={draft.marketIntelligence.providers.includes('yahoo_finance')}
                      onChange={(checked) => {
                        const providers = checked
                          ? Array.from(
                              new Set([...draft.marketIntelligence.providers, 'yahoo_finance'])
                            )
                          : draft.marketIntelligence.providers.filter(
                              (provider) => provider !== 'yahoo_finance'
                            );
                        setDraft({
                          ...draft,
                          marketIntelligence: {
                            ...draft.marketIntelligence,
                            providers: providers.length ? providers : ['yahoo_finance'],
                          },
                        });
                      }}
                    />
                    <CheckboxInput
                      label={t('strategyPage.advanced.fields.intelligenceProviderEarnings')}
                      checked={draft.marketIntelligence.providers.includes('earnings_calendar')}
                      onChange={(checked) => {
                        const providers = checked
                          ? Array.from(
                              new Set([...draft.marketIntelligence.providers, 'earnings_calendar'])
                            )
                          : draft.marketIntelligence.providers.filter(
                              (provider) => provider !== 'earnings_calendar'
                            );
                        setDraft({
                          ...draft,
                          marketIntelligence: {
                            ...draft.marketIntelligence,
                            providers: providers.length ? providers : ['yahoo_finance'],
                          },
                        });
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold mb-3">
                    {t('strategyPage.advanced.sections.marketIntelligenceLlm')}
                  </div>
                  <div className="space-y-3">
                    <CheckboxInput
                      label={t('strategyPage.advanced.fields.intelligenceLlmEnabled')}
                      checked={draft.marketIntelligence.llm.enabled}
                      onChange={(value) =>
                        setDraft({
                          ...draft,
                          marketIntelligence: {
                            ...draft.marketIntelligence,
                            llm: { ...draft.marketIntelligence.llm, enabled: value },
                          },
                        })
                      }
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <SelectInput
                        label={t('strategyPage.advanced.fields.intelligenceLlmProvider')}
                        value={draft.marketIntelligence.llm.provider}
                        options={intelligenceLlmProviderOptions}
                        onChange={(value) =>
                          setDraft({
                            ...draft,
                            marketIntelligence: {
                              ...draft.marketIntelligence,
                              llm: {
                                ...draft.marketIntelligence.llm,
                                provider: value as 'openai' | 'anthropic' | 'ollama' | 'mock',
                              },
                            },
                          })
                        }
                      />
                      <TextInput
                        label={t('strategyPage.advanced.fields.intelligenceLlmModel')}
                        value={draft.marketIntelligence.llm.model}
                        onChange={(value) =>
                          setDraft({
                            ...draft,
                            marketIntelligence: {
                              ...draft.marketIntelligence,
                              llm: { ...draft.marketIntelligence.llm, model: value },
                            },
                          })
                        }
                      />
                      <TextInput
                        label={t('strategyPage.advanced.fields.intelligenceLlmApiKey')}
                        value={draft.marketIntelligence.llm.apiKey}
                        onChange={(value) =>
                          setDraft({
                            ...draft,
                            marketIntelligence: {
                              ...draft.marketIntelligence,
                              llm: { ...draft.marketIntelligence.llm, apiKey: value },
                            },
                          })
                        }
                      />
                      <TextInput
                        label={t('strategyPage.advanced.fields.intelligenceLlmBaseUrl')}
                        value={draft.marketIntelligence.llm.baseUrl}
                        onChange={(value) =>
                          setDraft({
                            ...draft,
                            marketIntelligence: {
                              ...draft.marketIntelligence,
                              llm: { ...draft.marketIntelligence.llm, baseUrl: value },
                            },
                          })
                        }
                      />
                      <TextInput
                        label={t('strategyPage.advanced.fields.intelligenceLlmCachePath')}
                        value={draft.marketIntelligence.llm.cachePath}
                        onChange={(value) =>
                          setDraft({
                            ...draft,
                            marketIntelligence: {
                              ...draft.marketIntelligence,
                              llm: { ...draft.marketIntelligence.llm, cachePath: value },
                            },
                          })
                        }
                      />
                      <TextInput
                        label={t('strategyPage.advanced.fields.intelligenceLlmAuditPath')}
                        value={draft.marketIntelligence.llm.auditPath}
                        onChange={(value) =>
                          setDraft({
                            ...draft,
                            marketIntelligence: {
                              ...draft.marketIntelligence,
                              llm: { ...draft.marketIntelligence.llm, auditPath: value },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <CheckboxInput
                        label={t('strategyPage.advanced.fields.intelligenceLlmEnableCache')}
                        checked={draft.marketIntelligence.llm.enableCache}
                        onChange={(value) =>
                          setDraft({
                            ...draft,
                            marketIntelligence: {
                              ...draft.marketIntelligence,
                              llm: { ...draft.marketIntelligence.llm, enableCache: value },
                            },
                          })
                        }
                      />
                      <CheckboxInput
                        label={t('strategyPage.advanced.fields.intelligenceLlmEnableAudit')}
                        checked={draft.marketIntelligence.llm.enableAudit}
                        onChange={(value) =>
                          setDraft({
                            ...draft,
                            marketIntelligence: {
                              ...draft.marketIntelligence,
                              llm: { ...draft.marketIntelligence.llm, enableAudit: value },
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold mb-3">
                    {t('strategyPage.advanced.sections.marketIntelligenceCatalyst')}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <NumberInput
                      label={t('strategyPage.advanced.fields.intelligenceCatalystLookbackHours')}
                      value={draft.marketIntelligence.catalyst.lookbackHours}
                      onChange={(value) =>
                        setDraft({
                          ...draft,
                          marketIntelligence: {
                            ...draft.marketIntelligence,
                            catalyst: { ...draft.marketIntelligence.catalyst, lookbackHours: value },
                          },
                        })
                      }
                      step={1}
                      min={1}
                    />
                    <NumberInput
                      label={t('strategyPage.advanced.fields.intelligenceCatalystRecencyHalfLifeHours')}
                      value={draft.marketIntelligence.catalyst.recencyHalfLifeHours}
                      onChange={(value) =>
                        setDraft({
                          ...draft,
                          marketIntelligence: {
                            ...draft.marketIntelligence,
                            catalyst: {
                              ...draft.marketIntelligence.catalyst,
                              recencyHalfLifeHours: value,
                            },
                          },
                        })
                      }
                      step={1}
                      min={1}
                    />
                    <NumberInput
                      label={t('strategyPage.advanced.fields.intelligenceCatalystFalseCatalystReturnZ')}
                      value={draft.marketIntelligence.catalyst.falseCatalystReturnZ}
                      onChange={(value) =>
                        setDraft({
                          ...draft,
                          marketIntelligence: {
                            ...draft.marketIntelligence,
                            catalyst: {
                              ...draft.marketIntelligence.catalyst,
                              falseCatalystReturnZ: value,
                            },
                          },
                        })
                      }
                      step={0.1}
                      min={0}
                    />
                    <NumberInput
                      label={t('strategyPage.advanced.fields.intelligenceCatalystMinPriceReactionAtr')}
                      value={draft.marketIntelligence.catalyst.minPriceReactionAtr}
                      onChange={(value) =>
                        setDraft({
                          ...draft,
                          marketIntelligence: {
                            ...draft.marketIntelligence,
                            catalyst: {
                              ...draft.marketIntelligence.catalyst,
                              minPriceReactionAtr: value,
                            },
                          },
                        })
                      }
                      step={0.1}
                      min={0}
                    />
                  </div>
                  <div className="mt-3">
                    <CheckboxInput
                      label={t('strategyPage.advanced.fields.intelligenceCatalystRequirePriceConfirmation')}
                      checked={draft.marketIntelligence.catalyst.requirePriceConfirmation}
                      onChange={(value) =>
                        setDraft({
                          ...draft,
                          marketIntelligence: {
                            ...draft.marketIntelligence,
                            catalyst: {
                              ...draft.marketIntelligence.catalyst,
                              requirePriceConfirmation: value,
                            },
                          },
                        })
                      }
                    />
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold mb-3">
                    {t('strategyPage.advanced.sections.marketIntelligenceTheme')}
                  </div>
                  <div className="space-y-3">
                    <CheckboxInput
                      label={t('strategyPage.advanced.fields.intelligenceThemeEnabled')}
                      checked={draft.marketIntelligence.theme.enabled}
                      onChange={(value) =>
                        setDraft({
                          ...draft,
                          marketIntelligence: {
                            ...draft.marketIntelligence,
                            theme: { ...draft.marketIntelligence.theme, enabled: value },
                          },
                        })
                      }
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <NumberInput
                        label={t('strategyPage.advanced.fields.intelligenceThemeMinClusterSize')}
                        value={draft.marketIntelligence.theme.minClusterSize}
                        onChange={(value) =>
                          setDraft({
                            ...draft,
                            marketIntelligence: {
                              ...draft.marketIntelligence,
                              theme: { ...draft.marketIntelligence.theme, minClusterSize: value },
                            },
                          })
                        }
                        step={1}
                        min={1}
                      />
                      <NumberInput
                        label={t('strategyPage.advanced.fields.intelligenceThemeMinPeerConfirmation')}
                        value={draft.marketIntelligence.theme.minPeerConfirmation}
                        onChange={(value) =>
                          setDraft({
                            ...draft,
                            marketIntelligence: {
                              ...draft.marketIntelligence,
                              theme: { ...draft.marketIntelligence.theme, minPeerConfirmation: value },
                            },
                          })
                        }
                        step={1}
                        min={1}
                      />
                      <TextInput
                        label={t('strategyPage.advanced.fields.intelligenceThemeCuratedPeerMapPath')}
                        value={draft.marketIntelligence.theme.curatedPeerMapPath}
                        onChange={(value) =>
                          setDraft({
                            ...draft,
                            marketIntelligence: {
                              ...draft.marketIntelligence,
                              theme: { ...draft.marketIntelligence.theme, curatedPeerMapPath: value },
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold mb-3">
                    {t('strategyPage.advanced.sections.marketIntelligenceOpportunity')}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <NumberInput
                      label={t('strategyPage.advanced.fields.intelligenceOpportunityTechnicalWeight')}
                      value={draft.marketIntelligence.opportunity.technicalWeight}
                      onChange={(value) =>
                        setDraft({
                          ...draft,
                          marketIntelligence: {
                            ...draft.marketIntelligence,
                            opportunity: {
                              ...draft.marketIntelligence.opportunity,
                              technicalWeight: value,
                            },
                          },
                        })
                      }
                      step={0.05}
                      min={0}
                    />
                    <NumberInput
                      label={t('strategyPage.advanced.fields.intelligenceOpportunityCatalystWeight')}
                      value={draft.marketIntelligence.opportunity.catalystWeight}
                      onChange={(value) =>
                        setDraft({
                          ...draft,
                          marketIntelligence: {
                            ...draft.marketIntelligence,
                            opportunity: {
                              ...draft.marketIntelligence.opportunity,
                              catalystWeight: value,
                            },
                          },
                        })
                      }
                      step={0.05}
                      min={0}
                    />
                    <NumberInput
                      label={t('strategyPage.advanced.fields.intelligenceOpportunityMaxDaily')}
                      value={draft.marketIntelligence.opportunity.maxDailyOpportunities}
                      onChange={(value) =>
                        setDraft({
                          ...draft,
                          marketIntelligence: {
                            ...draft.marketIntelligence,
                            opportunity: {
                              ...draft.marketIntelligence.opportunity,
                              maxDailyOpportunities: value,
                            },
                          },
                        })
                      }
                      step={1}
                      min={1}
                    />
                    <NumberInput
                      label={t('strategyPage.advanced.fields.intelligenceOpportunityMinScore')}
                      value={draft.marketIntelligence.opportunity.minOpportunityScore}
                      onChange={(value) =>
                        setDraft({
                          ...draft,
                          marketIntelligence: {
                            ...draft.marketIntelligence,
                            opportunity: {
                              ...draft.marketIntelligence.opportunity,
                              minOpportunityScore: value,
                            },
                          },
                        })
                      }
                      step={0.05}
                      min={0}
                      max={1}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
