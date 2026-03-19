import { PlayCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useCallback, type ChangeEvent } from 'react';
import Button from '@/components/common/Button';
import type { DecisionActionFilter } from '@/features/screener/prioritization';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { t } from '@/i18n/t';

type CurrencyFilter = 'all' | 'usd' | 'eur';

const TOP_N_MAX = 200;

const formatCurrencyFilterLabel = (currencies: ('USD' | 'EUR')[]): string => {
  if (currencies.length === 1 && currencies[0] === 'USD') return t('screener.currencyFilter.usdOnly');
  if (currencies.length === 1 && currencies[0] === 'EUR') return t('screener.currencyFilter.eurOnly');
  return t('screener.currencyFilter.both');
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
  isBeginnerMode: boolean;
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
  recommendedOnly: boolean;
  setRecommendedOnly: (value: boolean) => void;
  actionFilter: DecisionActionFilter;
  setActionFilter: (value: DecisionActionFilter) => void;
  showAdvancedFilters: boolean;
  setShowAdvancedFilters: (value: boolean) => void;
  universes: string[];
  isLoading: boolean;
  accountSize: number;
  riskPct: number;
  activeCurrencies: ('USD' | 'EUR')[];
  onRun: () => void;
}

export default function ScreenerForm({
  isBeginnerMode,
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
  recommendedOnly,
  setRecommendedOnly,
  actionFilter,
  setActionFilter,
  showAdvancedFilters,
  setShowAdvancedFilters,
  universes,
  isLoading,
  accountSize,
  riskPct,
  activeCurrencies,
  onRun,
}: ScreenerFormProps) {
  // Memoized handlers to avoid recreating on every render and reduce duplication
  const handleTopNChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.target.value) || 20;
    const clamped = Math.min(Math.max(parsed, 1), TOP_N_MAX);
    setTopN(clamped);
  }, [setTopN]);

  const handleMinPriceChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setMinPrice(parseFloat(e.target.value) || 0);
  }, [setMinPrice]);

  const handleMaxPriceChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setMaxPrice(parseFloat(e.target.value) || 1000);
  }, [setMaxPrice]);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3 md:p-4">
      {/* Beginner Mode: Simple controls layout */}
      {isBeginnerMode && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 items-end">
            {/* Universe selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('screener.controls.universe')}</label>
              <select
                value={selectedUniverse}
                onChange={(e) => setSelectedUniverse(e.target.value)}
                aria-label={t('screener.controls.universe')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              >
                {universes.map((universe) => (
                  <option key={universe} value={universe}>
                    {universe}
                  </option>
                ))}
              </select>
            </div>

            {/* Recommended Only Filter */}
            <div className="min-h-11 flex items-center">
              <label className="flex min-h-11 items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recommendedOnly}
                  onChange={(e) => setRecommendedOnly(e.target.checked)}
                  aria-label={t('screener.controls.recommendedOnly')}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  disabled={isLoading}
                />
                <span className="text-sm font-medium text-gray-700">
                  {t('screener.controls.recommendedOnly')}
                </span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('screener.controls.actionFilter')}</label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value as DecisionActionFilter)}
                aria-label={t('screener.controls.actionFilter')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              >
                {(['all', 'BUY_NOW', 'BUY_ON_PULLBACK', 'WAIT_FOR_BREAKOUT', 'WATCH', 'TACTICAL_ONLY', 'AVOID', 'MANAGE_ONLY'] as const).map(
                  (value) => (
                    <option key={value} value={value}>
                      {formatActionFilterLabel(value)}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* Run button */}
            <div className="flex items-end xl:justify-end">
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

          {/* Advanced filters toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              aria-expanded={showAdvancedFilters}
              className="inline-flex min-h-11 items-center px-1 text-sm text-blue-600 hover:text-blue-800"
            >
              {showAdvancedFilters ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  {t('screener.controls.hideAdvanced')}
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  {t('screener.controls.showAdvanced')}
                </>
              )}
            </button>
          </div>

          {/* Advanced filters (collapsible in beginner mode) */}
          {showAdvancedFilters && (
            <div className="pt-3 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {/* Top N */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('screener.controls.topN')}</label>
                  <input
                    type="number"
                    value={topN}
                    onChange={handleTopNChange}
                    aria-label={t('screener.controls.topN')}
                    min="1"
                    max={TOP_N_MAX}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isLoading}
                  />
                </div>

                {/* Min Price */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('screener.controls.minPrice')}</label>
                  <input
                    type="number"
                    value={minPrice}
                    onChange={handleMinPriceChange}
                    aria-label={t('screener.controls.minPrice')}
                    min="0"
                    step="0.1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isLoading}
                  />
                </div>

                {/* Max Price */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('screener.controls.maxPrice')}</label>
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={handleMaxPriceChange}
                    aria-label={t('screener.controls.maxPrice')}
                    min="0"
                    step="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isLoading}
                  />
                </div>

                {/* Currency filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('screener.controls.currency')}</label>
                  <select
                    value={currencyFilter}
                    onChange={(e) => setCurrencyFilter(e.target.value as CurrencyFilter)}
                    aria-label={t('screener.controls.currency')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isLoading}
                  >
                    <option value="all">{t('screener.currencyFilter.all')}</option>
                    <option value="usd">{t('screener.currencyFilter.usdOnly')}</option>
                    <option value="eur">{t('screener.currencyFilter.eurOnly')}</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Account info (always visible in beginner mode) */}
          <div className="pt-3 border-t border-gray-200 text-xs text-gray-600 flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-gray-200 bg-white px-2 py-1">
              {t('screener.controls.account')}: {formatCurrency(accountSize)}
            </span>
            <span className="rounded-md border border-gray-200 bg-white px-2 py-1">
              {t('screener.controls.risk')}: {formatPercent(riskPct)}
            </span>
            <span className="rounded-md border border-gray-200 bg-white px-2 py-1">
              {t('screener.controls.currencySummary', {
                value: formatCurrencyFilterLabel(activeCurrencies),
              })}
            </span>
          </div>
        </div>
      )}

      {/* Advanced Mode: Full controls layout */}
      {!isBeginnerMode && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3 items-end">
          {/* Universe selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('screener.controls.universe')}</label>
            <select
              value={selectedUniverse}
              onChange={(e) => setSelectedUniverse(e.target.value)}
              aria-label={t('screener.controls.universe')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            >
              {universes.map((universe) => (
                <option key={universe} value={universe}>
                  {universe}
                </option>
              ))}
            </select>
          </div>

          {/* Top N */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('screener.controls.topN')}</label>
            <input
              type="number"
              value={topN}
              onChange={handleTopNChange}
              aria-label={t('screener.controls.topN')}
              min="1"
              max={TOP_N_MAX}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            />
          </div>

          {/* Min Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('screener.controls.minPrice')}</label>
            <input
              type="number"
              value={minPrice}
              onChange={handleMinPriceChange}
              aria-label={t('screener.controls.minPrice')}
              min="0"
              step="0.1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            />
          </div>

          {/* Max Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('screener.controls.maxPrice')}</label>
            <input
              type="number"
              value={maxPrice}
              onChange={handleMaxPriceChange}
              aria-label={t('screener.controls.maxPrice')}
              min="0"
              step="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            />
          </div>

          {/* Currency filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('screener.controls.currency')}</label>
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value as CurrencyFilter)}
              aria-label={t('screener.controls.currency')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            >
              <option value="all">{t('screener.currencyFilter.all')}</option>
              <option value="usd">{t('screener.currencyFilter.usdOnly')}</option>
              <option value="eur">{t('screener.currencyFilter.eurOnly')}</option>
            </select>
          </div>

          {/* Account info */}
          {/* Run button */}
          <div className="md:col-span-2 xl:col-span-2 flex items-end xl:justify-end">
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

          <div className="flex flex-col gap-3 border-t border-gray-200 pt-3 md:flex-row md:items-end md:justify-between">
            <div className="min-h-11 flex items-center">
              <label className="flex min-h-11 items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recommendedOnly}
                  onChange={(e) => setRecommendedOnly(e.target.checked)}
                  aria-label={t('screener.controls.recommendedOnly')}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  disabled={isLoading}
                />
                <span className="text-sm font-medium text-gray-700">
                  {t('screener.controls.recommendedOnly')}
                </span>
              </label>
            </div>

            <div className="w-full md:max-w-xs">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('screener.controls.actionFilter')}</label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value as DecisionActionFilter)}
                aria-label={t('screener.controls.actionFilter')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              >
                {(['all', 'BUY_NOW', 'BUY_ON_PULLBACK', 'WAIT_FOR_BREAKOUT', 'WATCH', 'TACTICAL_ONLY', 'AVOID', 'MANAGE_ONLY'] as const).map(
                  (value) => (
                    <option key={value} value={value}>
                      {formatActionFilterLabel(value)}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-200 text-xs text-gray-600 flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-gray-200 bg-white px-2 py-1">
              {t('screener.controls.account')}: {formatCurrency(accountSize)}
            </span>
            <span className="rounded-md border border-gray-200 bg-white px-2 py-1">
              {t('screener.controls.risk')}: {formatPercent(riskPct)}
            </span>
            <span className="rounded-md border border-gray-200 bg-white px-2 py-1">
              {t('screener.controls.currencySummary', {
                value: formatCurrencyFilterLabel(activeCurrencies),
              })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
