import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import { useStrategyEditor } from '@/features/strategy/useStrategyEditor';
import StrategyAdvancedSettingsCard from '@/components/domain/strategy/StrategyAdvancedSettingsCard';
import StrategyCoreSettingsCards from '@/components/domain/strategy/StrategyCoreSettingsCards';
import { t } from '@/i18n/t';
import {
  buildHelp,
  strategyFieldClass,
  TextInput,
} from '@/components/domain/strategy/StrategyFieldControls';

const help = {
  module: buildHelp(
    'Strategy Module',
    'Select the strategy logic used for screening.',
    'Defines which strategy module drives signals and recommendations.',
    'Keeps the architecture modular for future strategies.',
    'Start with Momentum; add others later.'
  ),
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
  currencies: buildHelp(
    'Currencies',
    'Filter eligible stocks by listing currency.',
    'Limits the screener universe to selected trading currencies.',
    'Helps keep selection aligned with account base currency and execution preferences.',
    'Use All for mixed universes, or choose USD/EUR for stricter filtering.'
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

export default function StrategyPage() {
  const {
    canCreate,
    createDescription,
    createId,
    createMutation,
    createName,
    deleteMutation,
    draft,
    handleCreate,
    handleDelete,
    handleReset,
    handleSave,
    handleSetActive,
    highFeeWarning,
    idAlreadyExists,
    isActive,
    lowRrWarning,
    selectedId,
    selectedStrategy,
    setCreateDescription,
    setCreateId,
    setCreateName,
    setDraft,
    setSelectedId,
    setShowAdvanced,
    showAdvanced,
    statusMessage,
    strategies,
    strategiesQuery,
    updateMutation,
  } = useStrategyEditor();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('strategyPage.header.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('strategyPage.header.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleReset} disabled={!draft || updateMutation.isPending}>
            {t('strategyPage.actions.resetChanges')}
          </Button>
          <Button onClick={handleSave} disabled={!draft || updateMutation.isPending}>
            {updateMutation.isPending ? t('strategyPage.actions.saving') : t('strategyPage.actions.saveChanges')}
          </Button>
        </div>
      </div>

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>{t('strategyPage.selection.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <label className="text-sm font-medium md:col-span-2">
              <div className="mb-2">{t('strategyPage.selection.chooseStrategy')}</div>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className={strategyFieldClass}
                disabled={strategiesQuery.isLoading}
              >
                {!strategies.length && (
                  <option value="">
                    {strategiesQuery.isLoading
                      ? t('strategyPage.selection.loadingStrategies')
                      : t('strategyPage.selection.noStrategies')}
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
                {isActive ? t('strategyPage.selection.active') : t('strategyPage.selection.setActive')}
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={!selectedStrategy || selectedStrategy?.isDefault || deleteMutation.isPending}
              >
                {deleteMutation.isPending ? t('strategyPage.selection.deleting') : t('common.actions.delete')}
              </Button>
              {selectedStrategy?.isDefault && (
                <span className="text-xs text-gray-500">{t('strategyPage.selection.default')}</span>
              )}
            </div>
          </div>
          <div className="mt-5 border-t border-border pt-4 space-y-3">
            <div className="text-sm font-semibold">{t('strategyPage.create.title')}</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TextInput
                label={t('strategyPage.create.newId')}
                value={createId}
                onChange={(value) => setCreateId(value)}
                placeholder={t('strategyPage.create.newIdPlaceholder')}
              />
              <TextInput
                label={t('strategyPage.create.newName')}
                value={createName}
                onChange={(value) => setCreateName(value)}
                placeholder={t('strategyPage.create.newNamePlaceholder')}
              />
              <TextInput
                label={t('strategyPage.create.newDescription')}
                value={createDescription}
                onChange={(value) => setCreateDescription(value)}
                placeholder={t('strategyPage.create.newDescriptionPlaceholder')}
              />
            </div>
            {idAlreadyExists && (
              <div className="text-xs text-red-600">{t('strategyPage.create.idAlreadyExists')}</div>
            )}
            <div className="flex items-center gap-2">
              <Button onClick={handleCreate} disabled={!canCreate}>
                {createMutation.isPending ? t('strategyPage.actions.saving') : t('strategyPage.create.saveAsNew')}
              </Button>
              <div className="text-xs text-gray-500">
                {t('strategyPage.create.idHint')}
              </div>
            </div>
          </div>
          {statusMessage && <div className="mt-3 text-sm text-green-600">{statusMessage}</div>}
          {updateMutation.isError && (
            <div className="mt-3 text-sm text-red-600">{t('strategyPage.errors.saveFailed')}</div>
          )}
          {createMutation.isError && (
            <div className="mt-3 text-sm text-red-600">
              {(createMutation.error as Error)?.message || t('strategyPage.errors.createFailed')}
            </div>
          )}
          {deleteMutation.isError && (
            <div className="mt-3 text-sm text-red-600">
              {(deleteMutation.error as Error)?.message || t('strategyPage.errors.deleteFailed')}
            </div>
          )}
        </CardContent>
      </Card>

      {!draft && (
        <Card variant="bordered">
          <CardContent>
            <div className="text-sm text-gray-500">{t('strategyPage.selection.selectToEdit')}</div>
          </CardContent>
        </Card>
      )}

      {draft && (
        <>
          <StrategyCoreSettingsCards
            draft={draft}
            setDraft={setDraft}
            help={help}
          />

          <StrategyAdvancedSettingsCard
            draft={draft}
            setDraft={setDraft}
            showAdvanced={showAdvanced}
            setShowAdvanced={setShowAdvanced}
            lowRrWarning={lowRrWarning}
            highFeeWarning={highFeeWarning}
            help={help}
          />
        </>
      )}
    </div>
  );
}
