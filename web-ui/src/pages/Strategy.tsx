import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import HelpTooltip from '@/components/common/HelpTooltip';
import {
  createStrategy,
  deleteStrategy,
  fetchActiveStrategy,
  fetchStrategies,
  setActiveStrategy,
  updateStrategy,
} from '@/lib/strategyApi';
import { Strategy, StrategyEntryType, StrategyExitMode } from '@/types/strategy';

const fieldClass =
  'w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800';

type HelpInfo = {
  short: string;
  title: string;
  content: ReactNode;
};

const buildHelp = (
  title: string,
  short: string,
  what: string,
  why: string,
  how: string
): HelpInfo => ({
  title,
  short,
  content: (
    <div className="space-y-2">
      <p>
        <strong>What it is:</strong> {what}
      </p>
      <p>
        <strong>Why it matters:</strong> {why}
      </p>
      <p>
        <strong>How to interpret:</strong> {how}
      </p>
    </div>
  ),
});

const help = {
  breakoutLookback: buildHelp(
    'Breakout Lookback',
    'Window for breakout highs/lows.',
    'The lookback window used to define recent highs or lows for breakout signals.',
    'Controls how strict the breakout condition is and filters out noise.',
    'Shorter windows react faster; longer windows require stronger, longer-term breakouts.'
  ),
  pullbackMa: buildHelp(
    'Pullback Moving Average',
    'MA used to confirm pullback entries.',
    'A moving average used as a reference line for pullback signals.',
    'Keeps pullbacks aligned with the prevailing trend before re-entry.',
    'Lower values track price closely; higher values require deeper pullbacks before entry.'
  ),
  minHistory: buildHelp(
    'Minimum History',
    'Bars required before indicators are valid.',
    'The minimum number of daily bars required to compute indicators reliably.',
    'Prevents signals based on insufficient data or partial lookbacks.',
    'Set at least as long as your longest lookback (e.g., SMA long or 12m momentum).'
  ),
  smaFast: buildHelp(
    'SMA Fast',
    'Short-term trend filter.',
    'A simple moving average over a short window.',
    'Captures near-term trend direction and responsiveness.',
    'Lower values respond faster but can whipsaw; higher values are smoother.'
  ),
  smaMid: buildHelp(
    'SMA Mid',
    'Intermediate trend filter.',
    'A simple moving average over a medium window.',
    'Defines the intermediate trend used in trend alignment checks.',
    'Lower values respond faster; higher values provide a steadier mid-term trend.'
  ),
  smaLong: buildHelp(
    'SMA Long',
    'Primary trend filter.',
    'A simple moving average over a long window.',
    'Sets the primary trend filter to keep the universe in longer-term uptrends.',
    'Higher values smooth long-term trend; lower values make the filter more responsive.'
  ),
  atrWindow: buildHelp(
    'ATR Window',
    'Lookback for volatility (ATR).',
    'The lookback period used to compute Average True Range (ATR).',
    'Volatility impacts position sizing, stops, and volatility filters.',
    'Higher windows smooth volatility; lower windows react faster to recent changes.'
  ),
  atrMultiplier: buildHelp(
    'ATR Multiplier',
    'Scales ATR for stops/position sizing.',
    'A multiplier applied to ATR when setting risk distance or stop logic.',
    'Normalizes risk across different volatility regimes.',
    'Higher values widen stops and reduce position size; lower values tighten stops.'
  ),
  minRr: buildHelp(
    'Minimum RR',
    'Minimum reward-to-risk for recommendations.',
    'The minimum reward-to-risk ratio required for a setup to be labeled Recommended.',
    'Encourages asymmetric payoff (letting winners run, cutting losers).',
    'Typical baseline is 2.0 or higher.'
  ),
  maxFeeRiskPct: buildHelp(
    'Max Fee/Risk %',
    'Fee-to-risk threshold for micro-trading.',
    'Maximum total estimated fees as a percentage of planned risk per trade.',
    'Prevents tiny positions where fees dominate expected edge.',
    'Example: 20% means fees must be <= 20% of planned risk.'
  ),
  maxAtrPct: buildHelp(
    'Max ATR %',
    'Maximum allowed ATR as % of price.',
    'The maximum ATR percentage of price allowed for eligible stocks.',
    'Filters out overly volatile names that can distort risk.',
    'Lower thresholds are stricter; higher thresholds allow more volatile stocks.'
  ),
  requireTrendOk: buildHelp(
    'Require Trend OK',
    'Filter using SMA trend alignment.',
    'Requires the trend filter to pass before a stock is eligible.',
    'Keeps the universe focused on established uptrends.',
    'Disable to allow counter-trend candidates or broader universes.'
  ),
  requireRsPositive: buildHelp(
    'Require RS Positive',
    'Require positive relative strength.',
    'Requires 6m relative strength versus the benchmark to be positive.',
    'Prioritizes stocks outperforming the market.',
    'Disable to allow laggards or turnaround candidates.'
  ),
  momentum6m: buildHelp(
    'Momentum 6m',
    '6-month return lookback.',
    'Percent return over the last ~6 months of trading days.',
    'Captures medium-term momentum used for ranking.',
    'Shorter values react quicker; longer values are more stable.'
  ),
  momentum12m: buildHelp(
    'Momentum 12m',
    '12-month return lookback.',
    'Percent return over the last ~12 months of trading days.',
    'Captures longer-term momentum for ranking stability.',
    'Longer values smooth noise but react slower to reversals.'
  ),
  benchmark: buildHelp(
    'Benchmark',
    'Reference ticker for relative strength.',
    'The benchmark used to compute relative strength comparisons.',
    'Keeps momentum and RS metrics grounded to a market baseline.',
    'Use a broad market ETF like SPY to focus on true outperformance.'
  ),
  weightMom6m: buildHelp(
    'Weight 6m',
    'Importance of 6m momentum in ranking.',
    'Weight applied to 6m momentum in the ranking score.',
    'Controls how strongly 6m momentum drives the final rank.',
    'Higher weight means 6m momentum dominates the score.'
  ),
  weightMom12m: buildHelp(
    'Weight 12m',
    'Importance of 12m momentum in ranking.',
    'Weight applied to 12m momentum in the ranking score.',
    'Balances longer-term trend persistence in rankings.',
    'Higher weight emphasizes longer-term strength.'
  ),
  weightRs: buildHelp(
    'Weight RS',
    'Importance of relative strength in ranking.',
    'Weight applied to relative strength in the ranking score.',
    'Rewards stocks outperforming the benchmark.',
    'Higher weight makes RS a bigger driver of rank.'
  ),
  trailSma: buildHelp(
    'Trail SMA',
    'Moving average used for trailing stops.',
    'The moving average used to trail stops once a position is in profit.',
    'Helps stay in trends while locking in gains.',
    'Shorter values tighten stops; longer values give trades more room.'
  ),
  smaBuffer: buildHelp(
    'SMA Buffer',
    'Extra cushion around the trailing SMA.',
    'A percentage buffer applied around the trailing SMA.',
    'Reduces stop-outs from minor volatility around the average.',
    'Higher buffers allow more room but may give back more gains.'
  ),
  regimeEnabled: buildHelp(
    'Regime Risk Scaling',
    'Scale risk down in adverse regimes.',
    'An optional ruleset that reduces risk when trend or volatility conditions are unfavorable.',
    'Protects capital during downtrends or high-volatility regimes.',
    'When enabled, risk is multiplied by the configured trend/volatility factors.'
  ),
  regimeTrendSma: buildHelp(
    'Trend SMA Window',
    'Benchmark SMA used for risk scaling.',
    'The SMA window applied to the benchmark for regime detection.',
    'A break below this SMA signals a risk-off trend.',
    'Common choice is 200 for long-term trend.'
  ),
  regimeTrendMultiplier: buildHelp(
    'Trend Multiplier',
    'Risk scaling when below SMA.',
    'Risk multiplier applied when the benchmark is below the trend SMA.',
    'Reduces exposure in risk-off trends.',
    '0.5 means you take half the normal risk.'
  ),
  regimeVolAtrWindow: buildHelp(
    'Volatility ATR Window',
    'ATR window for regime volatility.',
    'ATR window used to compute benchmark ATR%.',
    'Detects volatility spikes that merit reduced risk.',
    'Use the same window as your ATR (e.g., 14) for consistency.'
  ),
  regimeVolAtrPctThreshold: buildHelp(
    'Volatility Threshold',
    'ATR% level that triggers scaling.',
    'If benchmark ATR% exceeds this threshold, risk is reduced.',
    'Limits exposure during volatility spikes.',
    'Lower thresholds trigger scaling more often.'
  ),
  regimeVolMultiplier: buildHelp(
    'Volatility Multiplier',
    'Risk scaling during high volatility.',
    'Risk multiplier applied when benchmark ATR% exceeds the threshold.',
    'Reduces exposure during unstable periods.',
    '0.5 means you take half the normal risk.'
  ),
  socialOverlayEnabled: buildHelp(
    'Social Overlay',
    'Risk-only overlay using social signals.',
    'An optional safety layer that adjusts risk or flags trades when social activity is extreme.',
    'Helps reduce gap and slippage risk without changing the strategy ranking.',
    'Enable to apply conservative risk multipliers and review flags.'
  ),
  lookbackHours: buildHelp(
    'Lookback Hours',
    'Hours of social history to scan.',
    'The number of hours to look back for social mentions.',
    'Controls how far back the overlay searches for attention and sentiment.',
    'Shorter windows are more responsive; longer windows capture broader context.'
  ),
  attentionZThreshold: buildHelp(
    'Attention Z-Score',
    'Spike threshold vs baseline.',
    'Z-score threshold for attention spikes relative to recent history.',
    'Large spikes often increase gap risk and execution slippage.',
    'Higher values make the overlay trigger less often.'
  ),
  minSampleSize: buildHelp(
    'Min Sample Size',
    'Minimum mentions required.',
    'Minimum number of social mentions required before applying the overlay.',
    'Avoids acting on noisy, low-sample social data.',
    'Higher values require more data to trigger overlay rules.'
  ),
  negativeSentThreshold: buildHelp(
    'Negative Sentiment',
    'Threshold for negative tone.',
    'Sentiment score threshold that flags strong negative tone.',
    'High-confidence negative sentiment can indicate news or crowd panic risk.',
    'More negative values make the filter stricter.'
  ),
  sentimentConfThreshold: buildHelp(
    'Sentiment Confidence',
    'Confidence required for sentiment rule.',
    'Confidence threshold needed to act on sentiment scores.',
    'Prevents false positives from weak sentiment signals.',
    'Higher values require stronger, more consistent sentiment.'
  ),
  hypePercentileThreshold: buildHelp(
    'Hype Percentile',
    'Crowding threshold vs history.',
    'Percentile threshold for crowding based on mentions normalized by liquidity.',
    'Highly crowded names can gap and whipsaw; review is advised.',
    'Higher values make crowding alerts rarer.'
  ),
};

function cloneStrategy(strategy: Strategy): Strategy {
  return JSON.parse(JSON.stringify(strategy)) as Strategy;
}

function NumberInput({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix,
  help,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  help?: HelpInfo;
}) {
  return (
    <label className="text-sm font-medium">
      <div className="mb-2 flex items-center gap-2">
        <span>{label}</span>
        {help && <HelpTooltip short={help.short} title={help.title} content={help.content} />}
        {suffix && <span className="text-xs text-gray-500">{suffix}</span>}
      </div>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className={fieldClass}
        step={step}
        min={min}
        max={max}
      />
    </label>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  help?: HelpInfo;
}) {
  return (
    <label className="text-sm font-medium">
      <div className="mb-2 flex items-center gap-2">
        <span>{label}</span>
        {help && <HelpTooltip short={help.short} title={help.title} content={help.content} />}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={fieldClass}
      />
    </label>
  );
}

function CheckboxInput({
  label,
  checked,
  onChange,
  help,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  help?: HelpInfo;
}) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
        />
        <span>{label}</span>
      </label>
      {help && <HelpTooltip short={help.short} title={help.title} content={help.content} />}
    </div>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
  help,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  help?: HelpInfo;
}) {
  return (
    <label className="text-sm font-medium">
      <div className="mb-2 flex items-center gap-2">
        <span>{label}</span>
        {help && <HelpTooltip short={help.short} title={help.title} content={help.content} />}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={fieldClass}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function StrategyPage() {
  const queryClient = useQueryClient();

  const strategiesQuery = useQuery({
    queryKey: ['strategies'],
    queryFn: fetchStrategies,
  });

  const activeStrategyQuery = useQuery({
    queryKey: ['strategy-active'],
    queryFn: fetchActiveStrategy,
  });

  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<Strategy | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [createId, setCreateId] = useState('');
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  const setActiveMutation = useMutation({
    mutationFn: (strategyId: string) => setActiveStrategy(strategyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategy-active'] });
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateStrategy,
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
      queryClient.invalidateQueries({ queryKey: ['strategy-active'] });
      setDraft(cloneStrategy(updated));
      setStatusMessage('Saved');
      if (import.meta.env.MODE !== 'test') {
        window.setTimeout(() => setStatusMessage(null), 2000);
      }
    },
  });

  const strategies = strategiesQuery.data ?? [];
  const activeStrategy = activeStrategyQuery.data;

  const createMutation = useMutation({
    mutationFn: (payload: { id: string; name: string; description?: string }) => {
      if (!draft) throw new Error('No strategy selected');
      return createStrategy(draft, payload);
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
      queryClient.invalidateQueries({ queryKey: ['strategy-active'] });
      setSelectedId(created.id);
      setDraft(cloneStrategy(created));
      setCreateId('');
      setCreateName('');
      setCreateDescription('');
      setStatusMessage('Saved as new strategy');
      if (import.meta.env.MODE !== 'test') {
        window.setTimeout(() => setStatusMessage(null), 2500);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (strategyId: string) => deleteStrategy(strategyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
      queryClient.invalidateQueries({ queryKey: ['strategy-active'] });
      setSelectedId('');
      setDraft(null);
      setIsInitialized(false);
      setStatusMessage('Strategy deleted');
      if (import.meta.env.MODE !== 'test') {
        window.setTimeout(() => setStatusMessage(null), 2500);
      }
    },
  });

  useEffect(() => {
    if (isInitialized) return;
    if (activeStrategy) {
      setSelectedId(activeStrategy.id);
      setIsInitialized(true);
      return;
    }
    if (strategies.length) {
      setSelectedId(strategies[0].id);
      setIsInitialized(true);
    }
  }, [activeStrategy, isInitialized, strategies]);

  const selectedStrategy = useMemo(() => {
    return strategies.find((s) => s.id === selectedId) ?? null;
  }, [strategies, selectedId]);

  useEffect(() => {
    if (selectedStrategy) {
      setDraft(cloneStrategy(selectedStrategy));
    }
  }, [selectedStrategy]);

  const isActive = activeStrategy?.id === selectedStrategy?.id;

  const handleSave = () => {
    if (!draft) return;
    updateMutation.mutate(draft);
  };

  const handleReset = () => {
    if (selectedStrategy) {
      setDraft(cloneStrategy(selectedStrategy));
      setStatusMessage(null);
    }
  };

  const handleSetActive = () => {
    if (selectedStrategy) {
      setActiveMutation.mutate(selectedStrategy.id);
    }
  };

  const handleDelete = () => {
    if (!selectedStrategy || selectedStrategy.isDefault) return;
    const confirmed = window.confirm(
      `Delete strategy "${selectedStrategy.name}"? This cannot be undone.`
    );
    if (!confirmed) return;
    deleteMutation.mutate(selectedStrategy.id);
  };

  const normalizedCreateId = createId.trim();
  const normalizedCreateName = createName.trim();
  const idAlreadyExists = strategies.some((strategy) => strategy.id === normalizedCreateId);
  const canCreate =
    !!draft &&
    normalizedCreateId.length > 0 &&
    normalizedCreateName.length > 0 &&
    !idAlreadyExists &&
    !createMutation.isPending;

  const handleCreate = () => {
    if (!draft) return;
    if (!normalizedCreateId || !normalizedCreateName) return;
    const description =
      createDescription.trim().length > 0 ? createDescription.trim() : draft.description;
    createMutation.mutate({
      id: normalizedCreateId,
      name: normalizedCreateName,
      description,
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Strategy</h1>
          <p className="text-sm text-gray-500 mt-1">Edit screening, risk, and management rules.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleReset} disabled={!draft || updateMutation.isPending}>
            Reset Changes
          </Button>
          <Button onClick={handleSave} disabled={!draft || updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Strategy Selection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <label className="text-sm font-medium md:col-span-2">
              <div className="mb-2">Choose strategy</div>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className={fieldClass}
                disabled={strategiesQuery.isLoading}
              >
                {!strategies.length && (
                  <option value="">
                    {strategiesQuery.isLoading ? 'Loading strategies…' : 'No strategies'}
                  </option>
                )}
                {strategies.map((strategy) => (
                  <option key={strategy.id} value={strategy.id}>
                    {strategy.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={handleSetActive} disabled={!selectedStrategy || isActive}>
                {isActive ? 'Active' : 'Set Active'}
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={!selectedStrategy || selectedStrategy?.isDefault || deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </Button>
              {selectedStrategy?.isDefault && (
                <span className="text-xs text-gray-500">Default</span>
              )}
            </div>
          </div>
          <div className="mt-5 border-t border-border pt-4 space-y-3">
            <div className="text-sm font-semibold">Save as new strategy</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TextInput
                label="New ID"
                value={createId}
                onChange={(value) => setCreateId(value)}
                placeholder="momentum_v2"
              />
              <TextInput
                label="New Name"
                value={createName}
                onChange={(value) => setCreateName(value)}
                placeholder="Momentum v2"
              />
              <TextInput
                label="New Description"
                value={createDescription}
                onChange={(value) => setCreateDescription(value)}
                placeholder="Optional"
              />
            </div>
            {idAlreadyExists && (
              <div className="text-xs text-red-600">Strategy ID already exists.</div>
            )}
            <div className="flex items-center gap-2">
              <Button onClick={handleCreate} disabled={!canCreate}>
                {createMutation.isPending ? 'Saving…' : 'Save as New'}
              </Button>
              <div className="text-xs text-gray-500">
                IDs are permanent and used in reports & APIs.
              </div>
            </div>
          </div>
          {statusMessage && <div className="mt-3 text-sm text-green-600">{statusMessage}</div>}
          {updateMutation.isError && (
            <div className="mt-3 text-sm text-red-600">Failed to save strategy</div>
          )}
          {createMutation.isError && (
            <div className="mt-3 text-sm text-red-600">
              {(createMutation.error as Error)?.message || 'Failed to create strategy'}
            </div>
          )}
          {deleteMutation.isError && (
            <div className="mt-3 text-sm text-red-600">
              {(deleteMutation.error as Error)?.message || 'Failed to delete strategy'}
            </div>
          )}
        </CardContent>
      </Card>

      {!draft && (
        <Card variant="bordered">
          <CardContent>
            <div className="text-sm text-gray-500">Select a strategy to edit.</div>
          </CardContent>
        </Card>
      )}

      {draft && (
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    </div>
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
        </>
      )}
    </div>
  );
}
