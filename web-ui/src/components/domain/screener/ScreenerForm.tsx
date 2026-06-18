import { PlayCircle, RefreshCw, ChevronUp, Settings2 } from 'lucide-react';
import { useCallback, type ChangeEvent } from 'react';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import type { DecisionActionFilter } from '@/features/screener/prioritization';
import type { UniverseSummary } from '@/features/screener/types';
import { t } from '@/i18n/t';

type CurrencyFilter = 'all' | 'usd' | 'eur';
type ExchangeFilter = 'all' | 'us_primary' | 'europe_primary' | 'xams' | 'xetr' | 'xpar' | 'xmil' | 'xmad';
type InstrumentFilter = 'all' | 'equity' | 'etf';

const TOP_N_MAX = 200;

const universeFreshnessVariant = (status: UniverseSummary['freshness_status']): 'default' | 'success' | 'warning' | 'error' => {
  switch (status) {
    case 'fresh':
      return 'success';
    case 'review_due':
      return 'warning';
    case 'stale':
      return 'error';
    default:
      return 'default';
  }
};

const universeFreshnessLabel = (status: UniverseSummary['freshness_status']): string => {
  switch (status) {
    case 'fresh':
      return t('screener.universe.freshness.fresh');
    case 'review_due':
      return t('screener.universe.freshness.reviewDue');
    case 'stale':
      return t('screener.universe.freshness.stale');
    default:
      return t('screener.universe.freshness.unknown');
  }
};

const universeSourceLabel = (source: string): string => {
  if (source === 'euronext_review') return t('screener.universe.source.euronextReview');
  if (source === 'manual') return t('screener.universe.source.manual');
  return source;
};

const formatActionFilterLabel = (value: DecisionActionFilter): string => {
  switch (value) {
    case 'BUY_NOW':
      return t('workspacePage.panels.analysis.decisionSummary.actions.buyNow');
    case 'BUY_ON_PULLBACK':
      return t('workspacePage.panels.analysis.decisionSummary.actions.buyOnPullback');
    case 'WAIT_FOR_BREAKOUT':
      return t('workspacePage.panels.analysis.decisionSummary.actions.waitForBreakout');
    case 'WATCH':
      return t('workspacePage.panels.analysis.decisionSummary.actions.watch');
    case 'TACTICAL_ONLY':
      return t('workspacePage.panels.analysis.decisionSummary.actions.tacticalOnly');
    case 'AVOID':
      return t('workspacePage.panels.analysis.decisionSummary.actions.avoid');
    case 'MANAGE_ONLY':
      return t('workspacePage.panels.analysis.decisionSummary.actions.manageOnly');
    default:
      return t('screener.controls.allActions');
  }
};

interface ScreenerFormProps {
  selectedUniverse: string;
  setSelectedUniverse: (value: string) => void;
  topN: number;
  setTopN: (value: number) => void;
  minPrice: number;
  setMinPrice: (value: number) => void;
  maxPrice: number;
  setMaxPrice: (value: number) => void;
  currencyFilter: CurrencyFilter;
  setCurrencyFilter: (value: CurrencyFilter) => void;
  exchangeFilter: ExchangeFilter;
  setExchangeFilter: (value: ExchangeFilter) => void;
  instrumentFilter: InstrumentFilter;
  setInstrumentFilter: (value: InstrumentFilter) => void;
  includeOtc: boolean;
  setIncludeOtc: (value: boolean) => void;
  recommendedOnly: boolean;
  setRecommendedOnly: (value: boolean) => void;
  requireWeeklyUptrend: boolean;
  setRequireWeeklyUptrend: (value: boolean) => void;
  actionFilter: DecisionActionFilter;
  setActionFilter: (value: DecisionActionFilter) => void;
  universes: UniverseSummary[];
  isLoading: boolean;
  onRun: () => void;
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export default function ScreenerForm({
  selectedUniverse,
  setSelectedUniverse,
  topN,
  setTopN,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
  currencyFilter,
  setCurrencyFilter,
  exchangeFilter,
  setExchangeFilter,
  instrumentFilter,
  setInstrumentFilter,
  includeOtc,
  setIncludeOtc,
  recommendedOnly,
  setRecommendedOnly,
  requireWeeklyUptrend,
  setRequireWeeklyUptrend,
  actionFilter,
  setActionFilter,
  universes,
  isLoading,
  onRun,
  isCollapsed = false,
  onToggleCollapsed,
}: ScreenerFormProps) {
  const selectedUniverseMeta = universes.find((universe) => universe.id === selectedUniverse);

  const handleTopNChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.target.value) || 20;
    setTopN(Math.min(Math.max(parsed, 1), TOP_N_MAX));
  }, [setTopN]);

  const handleMinPriceChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setMinPrice(parseFloat(e.target.value) || 0);
  }, [setMinPrice]);

  const handleMaxPriceChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setMaxPrice(parseFloat(e.target.value) || 1000);
  }, [setMaxPrice]);

  if (isCollapsed) {
    return (
      <div className="rounded-lg border border-border bg-surface/60 p-3 space-y-2">
        {/* Row 1: Universe name + Run CTA */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {selectedUniverseMeta?.description ?? selectedUniverse}
            </span>
            {selectedUniverseMeta && (
              <span className="ml-2 text-xs text-muted">
                {t('screener.controls.memberCount', { count: String(selectedUniverseMeta.member_count) })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={onRun} disabled={isLoading} size="sm">
              {isLoading ? (
                <><RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />{t('screener.controls.running')}</>
              ) : (
                <><PlayCircle className="w-3.5 h-3.5 mr-1" />{t('screener.controls.run')}</>
              )}
            </Button>
            {onToggleCollapsed && (
              <button
                type="button"
                onClick={onToggleCollapsed}
                className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground px-1"
                aria-label={t('screener.controls.adjustFilters')}
              >
                <Settings2 className="w-3.5 h-3.5" />
                {t('screener.controls.adjustFilters')}
              </button>
            )}
          </div>
        </div>
        {/* Row 2: Key filter pills */}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
            {t('screener.controls.topN')}: {topN}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
            ${minPrice}–${maxPrice}
          </span>
          {currencyFilter !== 'all' && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
              {currencyFilter.toUpperCase()}
            </span>
          )}
          {exchangeFilter !== 'all' && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
              {exchangeFilter}
            </span>
          )}
          {instrumentFilter !== 'all' && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
              {instrumentFilter}
            </span>
          )}
          {!includeOtc && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
              {t('screener.controls.noOtc')}
            </span>
          )}
          {requireWeeklyUptrend && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {t('screener.controls.weeklyUptrend')}
            </span>
          )}
          {recommendedOnly && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {t('screener.controls.recommendedOnlyShort')}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface/60 p-3 md:p-4">
      {onToggleCollapsed && (
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground px-1"
            aria-label={t('screener.controls.hideFilters')}
          >
            <ChevronUp className="w-3.5 h-3.5" />
            {t('screener.controls.hideFilters')}
          </button>
        </div>
      )}

      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-8 gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">{t('screener.controls.universe')}</label>
            <select
              value={selectedUniverse}
              onChange={(e) => setSelectedUniverse(e.target.value)}
              aria-label={t('screener.controls.universe')}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary/40"
              disabled={isLoading}
            >
              {universes.map((universe) => (
                <option key={universe.id} value={universe.id}>
                  {universe.description} ({universe.member_count})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">{t('screener.controls.topN')}</label>
            <input
              type="number"
              value={topN}
              onChange={handleTopNChange}
              aria-label={t('screener.controls.topN')}
              min="1"
              max={TOP_N_MAX}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary/40"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">{t('screener.controls.minPrice')}</label>
            <input
              type="number"
              value={minPrice}
              onChange={handleMinPriceChange}
              aria-label={t('screener.controls.minPrice')}
              min="0"
              step="0.1"
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary/40"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">{t('screener.controls.maxPrice')}</label>
            <input
              type="number"
              value={maxPrice}
              onChange={handleMaxPriceChange}
              aria-label={t('screener.controls.maxPrice')}
              min="0"
              step="1"
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary/40"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">{t('screener.controls.currency')}</label>
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value as CurrencyFilter)}
              aria-label={t('screener.controls.currency')}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary/40"
              disabled={isLoading}
            >
              <option value="all">{t('screener.currencyFilter.all')}</option>
              <option value="usd">{t('screener.currencyFilter.usdOnly')}</option>
              <option value="eur">{t('screener.currencyFilter.eurOnly')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">{t('screener.controls.venue.label')}</label>
            <select
              value={exchangeFilter}
              onChange={(e) => setExchangeFilter(e.target.value as ExchangeFilter)}
              aria-label={t('screener.controls.venue.label')}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary/40"
              disabled={isLoading}
            >
              <option value="all">{t('screener.controls.venue.all')}</option>
              <option value="us_primary">{t('screener.controls.venue.usPrimary')}</option>
              <option value="europe_primary">{t('screener.controls.venue.europePrimary')}</option>
              <option value="xams">{t('screener.controls.venue.amsterdam')}</option>
              <option value="xetr">{t('screener.controls.venue.xetra')}</option>
              <option value="xpar">{t('screener.controls.venue.paris')}</option>
              <option value="xmil">{t('screener.controls.venue.milan')}</option>
              <option value="xmad">{t('screener.controls.venue.madrid')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">{t('screener.controls.instrument.label')}</label>
            <select
              value={instrumentFilter}
              onChange={(e) => setInstrumentFilter(e.target.value as InstrumentFilter)}
              aria-label={t('screener.controls.instrument.label')}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary/40"
              disabled={isLoading}
            >
              <option value="all">{t('screener.controls.instrument.all')}</option>
              <option value="equity">{t('screener.controls.instrument.stocks')}</option>
              <option value="etf">{t('screener.controls.instrument.etfs')}</option>
            </select>
          </div>

          <div className="md:col-span-2 xl:col-span-1 flex items-end xl:justify-end">
            <Button
              onClick={onRun}
              disabled={isLoading}
              className="w-full xl:w-auto xl:min-w-[10rem] whitespace-nowrap"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  {t('screener.controls.running')}
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4 mr-2" />
                  {t('screener.controls.run')}
                </>
              )}
            </Button>
          </div>
        </div>

        {selectedUniverseMeta ? (
          <div className="rounded-lg border border-border bg-surface px-3 py-2">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-xs text-muted">
                {t('screener.controls.memberCount', { count: String(selectedUniverseMeta.member_count) })}
                {' · '}
                {universeSourceLabel(selectedUniverseMeta.source)}
                {' · '}
                source as of {selectedUniverseMeta.source_asof}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={universeFreshnessVariant(selectedUniverseMeta.freshness_status)}>
                  {universeFreshnessLabel(selectedUniverseMeta.freshness_status)}
                </Badge>
                {selectedUniverseMeta.exchange_mics.map((mic) => (
                  <Badge key={mic} variant="default">{mic}</Badge>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-border pt-3 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <label className="flex min-h-11 items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!includeOtc}
                onChange={(e) => setIncludeOtc(!e.target.checked)}
                aria-label={t('screener.controls.excludeOtc')}
                className="w-5 h-5 text-primary border-border rounded focus:ring-primary"
                disabled={isLoading}
              />
              <span className="text-sm font-medium text-muted">{t('screener.controls.excludeOtc')}</span>
            </label>
            <label className="flex min-h-11 items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={recommendedOnly}
                onChange={(e) => setRecommendedOnly(e.target.checked)}
                aria-label={t('screener.controls.recommendedOnly')}
                className="w-5 h-5 text-primary border-border rounded focus:ring-primary"
                disabled={isLoading}
              />
              <span className="text-sm font-medium text-muted">{t('screener.controls.recommendedOnly')}</span>
            </label>
            <label className="flex min-h-11 items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={requireWeeklyUptrend}
                onChange={(e) => setRequireWeeklyUptrend(e.target.checked)}
                aria-label={t('screener.controls.requireWeeklyUptrend')}
                className="w-5 h-5 text-primary border-border rounded focus:ring-primary"
                disabled={isLoading}
              />
              <span className="text-sm font-medium text-muted">{t('screener.controls.requireWeeklyUptrend')}</span>
            </label>
          </div>

          <div className="w-full md:max-w-xs">
            <label className="block text-sm font-medium text-muted mb-1">{t('screener.controls.actionFilter')}</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value as DecisionActionFilter)}
              aria-label={t('screener.controls.actionFilter')}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary/40"
              disabled={isLoading}
            >
              {(['all', 'BUY_NOW', 'BUY_ON_PULLBACK', 'WAIT_FOR_BREAKOUT', 'WATCH', 'TACTICAL_ONLY', 'AVOID', 'MANAGE_ONLY'] as const).map(
                (value) => (
                  <option key={value} value={value}>{formatActionFilterLabel(value)}</option>
                )
              )}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
