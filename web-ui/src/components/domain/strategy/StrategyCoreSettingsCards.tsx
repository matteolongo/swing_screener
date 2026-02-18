import Card, { CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { t } from '@/i18n/t';
import {
  CheckboxInput,
  HelpInfo,
  NumberInput,
  SelectInput,
  TextInput,
} from '@/components/domain/strategy/StrategyFieldControls';
import { Strategy, StrategyCurrency } from '@/features/strategy/types';
import type { ValidationWarning } from '@/features/strategy/api';
import EnhancedSignalsCard from './EnhancedSignalsCard';
import EnhancedRiskCard from './EnhancedRiskCard';

type CurrencyFilterValue = 'all' | 'usd' | 'eur';

function currenciesToFilterValue(currencies: StrategyCurrency[]): CurrencyFilterValue {
  const hasUsd = currencies.includes('USD');
  const hasEur = currencies.includes('EUR');
  if (hasUsd && !hasEur) return 'usd';
  if (!hasUsd && hasEur) return 'eur';
  return 'all';
}

function filterValueToCurrencies(value: CurrencyFilterValue): StrategyCurrency[] {
  if (value === 'usd') return ['USD'];
  if (value === 'eur') return ['EUR'];
  return ['USD', 'EUR'];
}

interface StrategyCoreSettingsCardsProps {
  draft: Strategy;
  setDraft: (value: Strategy) => void;
  help: Record<string, HelpInfo>;
  validationWarnings: ValidationWarning[];
  useEnhancedEducation?: boolean; // Enable enhanced educational components
}

export default function StrategyCoreSettingsCards({
  draft,
  setDraft,
  help,
  validationWarnings,
  useEnhancedEducation = true, // Default to enhanced mode
}: StrategyCoreSettingsCardsProps) {
  const strategyModules = [
    { value: 'momentum', label: t('strategyPage.core.options.moduleMomentumDefault') },
  ];

  const currencyFilterOptions = [
    { value: 'all', label: t('strategyPage.core.options.currencyAll') },
    { value: 'usd', label: t('strategyPage.core.options.currencyUsd') },
    { value: 'eur', label: t('strategyPage.core.options.currencyEur') },
  ];

  return (
    <>
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>{t('strategyPage.core.cards.basics.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput
              label={t('strategyPage.core.fields.name')}
              value={draft.name}
              onChange={(value) => setDraft({ ...draft, name: value })}
            />
            <TextInput
              label={t('strategyPage.core.fields.description')}
              value={draft.description ?? ''}
              onChange={(value) => setDraft({ ...draft, description: value })}
              placeholder={t('strategyPage.core.fields.descriptionPlaceholder')}
            />
            <SelectInput
              label={t('strategyPage.core.fields.strategyModule')}
              value={draft.module ?? 'momentum'}
              onChange={(value) => setDraft({ ...draft, module: value })}
              options={strategyModules}
              help={help.module}
            />
          </div>
          <div className="mt-3 text-xs text-gray-500">
            {t('strategyPage.core.fields.idValue', { id: draft.id })}
          </div>
        </CardContent>
      </Card>

      {/* Risk & Position Sizing - Use enhanced version if enabled */}
      {useEnhancedEducation ? (
        <EnhancedRiskCard draft={draft} setDraft={setDraft} warnings={validationWarnings} />
      ) : (
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>{t('strategyPage.core.cards.riskPosition.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumberInput
                label={t('strategyPage.core.fields.accountSize')}
                value={draft.risk.accountSize}
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    risk: { ...draft.risk, accountSize: value },
                  })
                }
                step={1000}
                min={0}
              />
              <NumberInput
                label={t('strategyPage.core.fields.riskPerTrade')}
                value={draft.risk.riskPct * 100}
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    risk: { ...draft.risk, riskPct: value / 100 },
                  })
                }
                step={0.1}
                min={0}
                suffix="%"
              />
              <NumberInput
                label={t('strategyPage.core.fields.maxPositionSize')}
                value={draft.risk.maxPositionPct * 100}
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    risk: { ...draft.risk, maxPositionPct: value / 100 },
                  })
                }
                step={1}
                min={0}
                suffix="%"
              />
              <NumberInput
                label={t('strategyPage.core.fields.atrMultiplier')}
                value={draft.risk.kAtr}
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    risk: { ...draft.risk, kAtr: value },
                  })
                }
                step={0.1}
                min={0}
                help={help.atrMultiplier}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>{t('strategyPage.core.cards.socialOverlay.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <CheckboxInput
              label={t('strategyPage.core.fields.enableSocialOverlay')}
              checked={draft.socialOverlay.enabled}
              onChange={(value) =>
                setDraft({
                  ...draft,
                  socialOverlay: { ...draft.socialOverlay, enabled: value },
                })
              }
              help={help.socialOverlayEnabled}
            />
            {draft.socialOverlay.enabled && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <NumberInput
                  label={t('strategyPage.core.fields.lookbackHours')}
                  value={draft.socialOverlay.lookbackHours}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      socialOverlay: { ...draft.socialOverlay, lookbackHours: value },
                    })
                  }
                  step={1}
                  min={1}
                  help={help.lookbackHours}
                />
                <NumberInput
                  label={t('strategyPage.core.fields.attentionZThreshold')}
                  value={draft.socialOverlay.attentionZThreshold}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      socialOverlay: { ...draft.socialOverlay, attentionZThreshold: value },
                    })
                  }
                  step={0.1}
                  min={0}
                  help={help.attentionZThreshold}
                />
                <NumberInput
                  label={t('strategyPage.core.fields.minSampleSize')}
                  value={draft.socialOverlay.minSampleSize}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      socialOverlay: { ...draft.socialOverlay, minSampleSize: value },
                    })
                  }
                  step={1}
                  min={0}
                  help={help.minSampleSize}
                />
                <NumberInput
                  label={t('strategyPage.core.fields.negativeSentiment')}
                  value={draft.socialOverlay.negativeSentThreshold}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      socialOverlay: { ...draft.socialOverlay, negativeSentThreshold: value },
                    })
                  }
                  step={0.05}
                  min={-1}
                  max={0}
                  help={help.negativeSentThreshold}
                />
                <NumberInput
                  label={t('strategyPage.core.fields.sentimentConfidence')}
                  value={draft.socialOverlay.sentimentConfThreshold}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      socialOverlay: { ...draft.socialOverlay, sentimentConfThreshold: value },
                    })
                  }
                  step={0.05}
                  min={0}
                  max={1}
                  help={help.sentimentConfThreshold}
                />
                <NumberInput
                  label={t('strategyPage.core.fields.hypePercentile')}
                  value={draft.socialOverlay.hypePercentileThreshold}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      socialOverlay: { ...draft.socialOverlay, hypePercentileThreshold: value },
                    })
                  }
                  step={1}
                  min={0}
                  max={100}
                  help={help.hypePercentileThreshold}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Signals - Use enhanced version if enabled */}
      {useEnhancedEducation ? (
        <EnhancedSignalsCard draft={draft} setDraft={setDraft} warnings={validationWarnings} />
      ) : (
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>{t('strategyPage.core.cards.signals.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <NumberInput
                label={t('strategyPage.core.fields.breakoutLookback')}
                value={draft.signals.breakoutLookback}
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    signals: { ...draft.signals, breakoutLookback: value },
                  })
                }
                step={1}
                min={1}
                help={help.breakoutLookback}
              />
              <NumberInput
                label={t('strategyPage.core.fields.pullbackMa')}
                value={draft.signals.pullbackMa}
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    signals: { ...draft.signals, pullbackMa: value },
                  })
                }
                step={1}
                min={1}
                help={help.pullbackMa}
              />
              <NumberInput
                label={t('strategyPage.core.fields.minHistory')}
                value={draft.signals.minHistory}
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    signals: { ...draft.signals, minHistory: value },
                  })
                }
                step={1}
                min={1}
                help={help.minHistory}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>{t('strategyPage.core.cards.universeFilters.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <NumberInput
              label={t('strategyPage.core.fields.minPrice')}
              value={draft.universe.filt.minPrice}
              onChange={(value) =>
                setDraft({
                  ...draft,
                  universe: {
                    ...draft.universe,
                    filt: { ...draft.universe.filt, minPrice: value },
                  },
                })
              }
              step={0.5}
              min={0}
            />
            <NumberInput
              label={t('strategyPage.core.fields.maxPrice')}
              value={draft.universe.filt.maxPrice}
              onChange={(value) =>
                setDraft({
                  ...draft,
                  universe: {
                    ...draft.universe,
                    filt: { ...draft.universe.filt, maxPrice: value },
                  },
                })
              }
              step={1}
              min={0}
            />
            <SelectInput
              label={t('strategyPage.core.fields.currencies')}
              value={currenciesToFilterValue(draft.universe.filt.currencies)}
              onChange={(value) =>
                setDraft({
                  ...draft,
                  universe: {
                    ...draft.universe,
                    filt: {
                      ...draft.universe.filt,
                      currencies: filterValueToCurrencies(value as CurrencyFilterValue),
                    },
                  },
                })
              }
              options={currencyFilterOptions}
              help={help.currencies}
            />
          </div>
        </CardContent>
      </Card>

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>{t('strategyPage.core.cards.ranking.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NumberInput
              label={t('strategyPage.core.fields.topN')}
              value={draft.ranking.topN}
              onChange={(value) =>
                setDraft({
                  ...draft,
                  ranking: { ...draft.ranking, topN: value },
                })
              }
              step={1}
              min={1}
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
