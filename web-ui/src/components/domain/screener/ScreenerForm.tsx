import { PlayCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { t } from '@/i18n/t';

type CurrencyFilter = 'all' | 'usd' | 'eur';

const TOP_N_MAX = 200;

const formatCurrencyFilterLabel = (currencies: ('USD' | 'EUR')[]): string => {
  if (currencies.length === 1 && currencies[0] === 'USD') return t('screener.currencyFilter.usdOnly');
  if (currencies.length === 1 && currencies[0] === 'EUR') return t('screener.currencyFilter.eurOnly');
  return t('screener.currencyFilter.both');
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
  showAdvancedFilters,
  setShowAdvancedFilters,
  universes,
  isLoading,
  accountSize,
  riskPct,
  activeCurrencies,
  onRun,
}: ScreenerFormProps) {
  return (
    <Card>
      {/* Beginner Mode: Simple controls layout */}
      {isBeginnerMode && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Universe selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('screener.controls.universe')}</label>
              <select
                value={selectedUniverse}
                onChange={(e) => setSelectedUniverse(e.target.value)}
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
            <div className="flex items-end">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recommendedOnly}
                  onChange={(e) => setRecommendedOnly(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  disabled={isLoading}
                />
                <span className="text-sm font-medium text-gray-700">
                  {t('screener.controls.recommendedOnly')}
                </span>
              </label>
            </div>

            {/* Run button */}
            <div className="flex items-end">
              <Button
                onClick={onRun}
                disabled={isLoading}
                className="w-full"
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
              className="flex items-center text-sm text-blue-600 hover:text-blue-800"
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
            <div className="pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Top N */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('screener.controls.topN')}</label>
                  <input
                    type="number"
                    value={topN}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value) || 20;
                      const clamped = Math.min(Math.max(parsed, 1), TOP_N_MAX);
                      setTopN(clamped);
                    }}
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
                    onChange={(e) => setMinPrice(parseFloat(e.target.value) || 0)}
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
                    onChange={(e) => setMaxPrice(parseFloat(e.target.value) || 1000)}
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
          <div className="pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              <div>
                {t('screener.controls.account')}: {formatCurrency(accountSize)}
              </div>
              <div>
                {t('screener.controls.risk')}: {formatPercent(riskPct)}
              </div>
              <div>
                {t('screener.controls.currencySummary', {
                  value: formatCurrencyFilterLabel(activeCurrencies),
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Mode: Full controls layout */}
      {!isBeginnerMode && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {/* Universe selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('screener.controls.universe')}</label>
            <select
              value={selectedUniverse}
              onChange={(e) => setSelectedUniverse(e.target.value)}
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
              onChange={(e) => {
                const parsed = parseInt(e.target.value) || 20;
                const clamped = Math.min(Math.max(parsed, 1), TOP_N_MAX);
                setTopN(clamped);
              }}
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
              onChange={(e) => setMinPrice(parseFloat(e.target.value) || 0)}
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
              onChange={(e) => setMaxPrice(parseFloat(e.target.value) || 1000)}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            >
              <option value="all">{t('screener.currencyFilter.all')}</option>
              <option value="usd">{t('screener.currencyFilter.usdOnly')}</option>
              <option value="eur">{t('screener.currencyFilter.eurOnly')}</option>
            </select>
          </div>

          {/* Account info */}
          <div className="flex items-end">
            <div className="text-sm text-gray-600">
              <div>
                {t('screener.controls.account')}: {formatCurrency(accountSize)}
              </div>
              <div>
                {t('screener.controls.risk')}: {formatPercent(riskPct)}
              </div>
              <div>
                {t('screener.controls.currencySummary', {
                  value: formatCurrencyFilterLabel(activeCurrencies),
                })}
              </div>
            </div>
          </div>

          {/* Run button */}
          <div className="flex items-end">
            <Button
              onClick={onRun}
              disabled={isLoading}
              className="w-full"
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
      )}
    </Card>
  );
}
