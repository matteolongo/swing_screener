import { PlayCircle, RefreshCw, ChevronUp, Settings2 } from 'lucide-react';
import { useCallback, type ChangeEvent } from 'react';
import Button from '@/components/common/Button';
import Field from '@/components/common/Field';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import QuickFilterBar from '@/components/domain/screener/QuickFilterBar';
import type { DecisionActionFilter } from '@/features/screener/prioritization';
import { formatDecisionAction } from '@/features/screener/decisionSummary';
import type { TaxonomyFilterValues } from '@/features/pool/types';
import { t } from '@/i18n/t';

type CurrencyFilter = 'all' | 'usd' | 'eur';
type ExchangeFilter = 'all' | 'us_primary' | 'europe_primary' | 'xams' | 'xetr' | 'xpar' | 'xmil' | 'xmad';

const TOP_N_MAX = 200;

const formatActionFilterLabel = (value: DecisionActionFilter): string =>
  value === 'all' ? t('screener.controls.allActions') : formatDecisionAction(value);

const activeFilterCount = (filter: TaxonomyFilterValues): number =>
  Object.values(filter).reduce((sum, v) => sum + (v?.length ?? 0), 0);

interface ScreenerFormProps {
  taxonomyFilter: TaxonomyFilterValues;
  setTaxonomyFilter: (value: TaxonomyFilterValues) => void;
  presetId: string | null;
  setPresetId: (value: string | null) => void;
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
  includeOtc: boolean;
  setIncludeOtc: (value: boolean) => void;
  recommendedOnly: boolean;
  setRecommendedOnly: (value: boolean) => void;
  requireWeeklyUptrend: boolean;
  setRequireWeeklyUptrend: (value: boolean) => void;
  actionFilter: DecisionActionFilter;
  setActionFilter: (value: DecisionActionFilter) => void;
  isLoading: boolean;
  onRun: () => void;
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
  forceRefresh: boolean;
  setForceRefresh: (value: boolean) => void;
}

export default function ScreenerForm({
  taxonomyFilter,
  setTaxonomyFilter,
  presetId,
  setPresetId,
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
  includeOtc,
  setIncludeOtc,
  recommendedOnly,
  setRecommendedOnly,
  requireWeeklyUptrend,
  setRequireWeeklyUptrend,
  actionFilter,
  setActionFilter,
  isLoading,
  onRun,
  isCollapsed = false,
  onToggleCollapsed,
  forceRefresh,
  setForceRefresh,
}: ScreenerFormProps) {
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

  const filterCount = activeFilterCount(taxonomyFilter);

  if (isCollapsed) {
    return (
      <div className="rounded-lg border border-border bg-surface/60 p-3 space-y-2">
        {/* Row 1: filter summary + Run CTA */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-sm font-semibold text-foreground">
              {presetId
                ? t('screener.taxonomy.preset')
                : filterCount > 0
                  ? t('screener.taxonomy.preset')
                  : t('screener.controls.run')}
            </span>
            <span className="ml-2 text-xs text-muted">
              {presetId ?? (filterCount > 0 ? `${filterCount}` : t('screener.taxonomy.sector.placeholder'))}
            </span>
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
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-foreground/10 text-muted">
            {t('screener.controls.topN')}: {topN}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-foreground/10 text-muted">
            ${minPrice}–${maxPrice}
          </span>
          {currencyFilter !== 'all' && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-foreground/10 text-muted">
              {currencyFilter.toUpperCase()}
            </span>
          )}
          {exchangeFilter !== 'all' && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-foreground/10 text-muted">
              {exchangeFilter}
            </span>
          )}
          {!includeOtc && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-foreground/10 text-muted">
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
        <QuickFilterBar
          value={taxonomyFilter}
          onChange={setTaxonomyFilter}
          presetId={presetId}
          onPresetChange={setPresetId}
          disabled={isLoading}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 items-end">
          <Field label={t('screener.controls.topN')}>
            <Input
              type="number"
              value={topN}
              onChange={handleTopNChange}
              min="1"
              max={TOP_N_MAX}
              disabled={isLoading}
            />
          </Field>

          <Field label={t('screener.controls.minPrice')}>
            <Input
              type="number"
              value={minPrice}
              onChange={handleMinPriceChange}
              min="0"
              step="0.1"
              disabled={isLoading}
            />
          </Field>

          <Field label={t('screener.controls.maxPrice')}>
            <Input
              type="number"
              value={maxPrice}
              onChange={handleMaxPriceChange}
              min="0"
              step="1"
              disabled={isLoading}
            />
          </Field>

          <Field label={t('screener.controls.currency')}>
            <Select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value as CurrencyFilter)}
              disabled={isLoading}
            >
              <option value="all">{t('screener.currencyFilter.all')}</option>
              <option value="usd">{t('screener.currencyFilter.usdOnly')}</option>
              <option value="eur">{t('screener.currencyFilter.eurOnly')}</option>
            </Select>
          </Field>

          <Field label={t('screener.controls.venue.label')}>
            <Select
              value={exchangeFilter}
              onChange={(e) => setExchangeFilter(e.target.value as ExchangeFilter)}
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
            </Select>
          </Field>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={onRun}
            disabled={isLoading}
            className="w-full md:w-auto md:min-w-[10rem] whitespace-nowrap"
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
            <label className="flex min-h-11 items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={forceRefresh}
                onChange={(e) => setForceRefresh(e.target.checked)}
                aria-label={t('screener.controls.forceRefresh')}
                className="w-5 h-5 text-primary border-border rounded focus:ring-primary"
                disabled={isLoading}
              />
              <span className="text-sm font-medium text-muted">{t('screener.controls.forceRefresh')}</span>
              {forceRefresh && (
                <span className="text-xs text-warning">{t('screener.controls.forceRefreshWarning')}</span>
              )}
            </label>
          </div>

          <Field label={t('screener.controls.actionFilter')} className="w-full md:max-w-xs">
            <Select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value as DecisionActionFilter)}
              disabled={isLoading}
            >
              {(['all', 'BUY_NOW', 'BUY_ON_PULLBACK', 'WAIT_FOR_BREAKOUT', 'WATCH', 'TACTICAL_ONLY', 'AVOID', 'MANAGE_ONLY'] as const).map(
                (value) => (
                  <option key={value} value={value}>{formatActionFilterLabel(value)}</option>
                )
              )}
            </Select>
          </Field>
        </div>
      </div>
    </div>
  );
}
