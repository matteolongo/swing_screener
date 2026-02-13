import Card, { CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import {
  CheckboxInput,
  NumberInput,
  SelectInput,
  TextInput,
} from '@/components/domain/strategy/StrategyFieldControls';
import { Strategy, StrategyCurrency } from '@/features/strategy/types';

const STRATEGY_MODULES = [
  { value: 'momentum', label: 'Momentum (default)' },
];

const CURRENCY_FILTER_OPTIONS = [
  { value: 'all', label: 'All currencies (USD + EUR)' },
  { value: 'usd', label: 'USD only' },
  { value: 'eur', label: 'EUR only' },
];

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
  help: Record<string, any>;
}

export default function StrategyCoreSettingsCards({
  draft,
  setDraft,
  help,
}: StrategyCoreSettingsCardsProps) {
  return (
    <>
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Basics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput
              label="Name"
              value={draft.name}
              onChange={(value) => setDraft({ ...draft, name: value })}
            />
            <TextInput
              label="Description"
              value={draft.description ?? ''}
              onChange={(value) => setDraft({ ...draft, description: value })}
              placeholder="Optional description"
            />
            <SelectInput
              label="Strategy Module"
              value={draft.module ?? 'momentum'}
              onChange={(value) => setDraft({ ...draft, module: value })}
              options={STRATEGY_MODULES}
              help={help.module}
            />
          </div>
          <div className="mt-3 text-xs text-gray-500">ID: {draft.id}</div>
        </CardContent>
      </Card>

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Risk & Position Sizing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NumberInput
              label="Account Size"
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
              label="Risk Per Trade"
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
              label="Max Position Size"
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
              label="ATR Multiplier"
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

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Social Overlay</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <CheckboxInput
              label="Enable Social Overlay"
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
                  label="Lookback Hours"
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
                  label="Attention Z Threshold"
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
                  label="Min Sample Size"
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
                  label="Negative Sentiment"
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
                  label="Sentiment Confidence"
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
                  label="Hype Percentile"
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

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Signals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <NumberInput
              label="Breakout Lookback"
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
              label="Pullback MA"
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
              label="Min History"
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

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Universe Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <NumberInput
              label="Min Price"
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
              label="Max Price"
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
              label="Currencies"
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
              options={CURRENCY_FILTER_OPTIONS}
              help={help.currencies}
            />
          </div>
        </CardContent>
      </Card>

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Ranking</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NumberInput
              label="Top N"
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
