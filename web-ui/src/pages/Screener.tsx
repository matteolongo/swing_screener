import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PlayCircle, RefreshCw, TrendingUp, AlertCircle, BarChart3, MessageSquare, ListChecks, Lightbulb } from 'lucide-react';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import TableShell from '@/components/common/TableShell';
import { useUniverses, useRunScreenerMutation } from '@/features/screener/hooks';
import { ScreenerCandidate } from '@/features/screener/types';
import { useConfigStore } from '@/stores/configStore';
import { RiskConfig } from '@/types/config';
import { useScreenerStore } from '@/stores/screenerStore';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import QuickBacktestModal from '@/components/modals/QuickBacktestModal';
import SocialAnalysisModal from '@/components/modals/SocialAnalysisModal';
import TradeThesisModal from '@/components/modals/TradeThesisModal';
import MetricHelpLabel from '@/components/domain/education/MetricHelpLabel';
import GlossaryLegend from '@/components/domain/education/GlossaryLegend';
import { SCREENER_GLOSSARY_KEYS } from '@/content/educationGlossary';
import { useActiveStrategyQuery } from '@/features/strategy/hooks';
import OverlayBadge from '@/components/domain/recommendation/OverlayBadge';
import RecommendationBadge from '@/components/domain/recommendation/RecommendationBadge';
import RecommendationDetailsModal from '@/components/domain/recommendation/RecommendationDetailsModal';
import CandidateOrderModal from '@/components/domain/orders/CandidateOrderModal';
import { queryKeys } from '@/lib/queryKeys';
import { t } from '@/i18n/t';

const TOP_N_MAX = 200;
type CurrencyFilter = 'all' | 'usd' | 'eur';
const UNIVERSE_ALIASES: Record<string, string> = {
  mega: 'mega_all',
  mega_defense: 'defense_all',
  mega_healthcare_biotech: 'healthcare_all',
  mega_europe: 'europe_large',
};
const normalizeCurrencies = (currencies?: string[]): ('USD' | 'EUR')[] => {
  const normalized = (currencies ?? [])
    .map((value) => value.toUpperCase())
    .filter((value): value is 'USD' | 'EUR' => value === 'USD' || value === 'EUR');
  return normalized.length ? Array.from(new Set(normalized)) : ['USD', 'EUR'];
};
const formatCurrencyFilterLabel = (currencies: ('USD' | 'EUR')[]): string => {
  if (currencies.length === 1 && currencies[0] === 'USD') return t('screener.currencyFilter.usdOnly');
  if (currencies.length === 1 && currencies[0] === 'EUR') return t('screener.currencyFilter.eurOnly');
  return t('screener.currencyFilter.both');
};
const currencyFilterToRequest = (value: CurrencyFilter): string[] => {
  if (value === 'usd') return ['USD'];
  if (value === 'eur') return ['EUR'];
  return ['USD', 'EUR'];
};
const normalizeUniverse = (value: string | null) => {
  if (!value) return null;
  return UNIVERSE_ALIASES[value] ?? value;
};
export default function Screener() {
  const { config } = useConfigStore();
  const { lastResult, setLastResult } = useScreenerStore();
  const queryClient = useQueryClient();
  const activeStrategyQuery = useActiveStrategyQuery();
  const riskConfig: RiskConfig = activeStrategyQuery.data?.risk ?? config.risk;
  const activeCurrencies = normalizeCurrencies(activeStrategyQuery.data?.universe?.filt?.currencies);
  
  // Load saved preferences from localStorage or use defaults
  const [selectedUniverse, setSelectedUniverse] = useState<string>(() => {
    return normalizeUniverse(localStorage.getItem('screener.universe')) || 'mega_all';
  });
  const [topN, setTopN] = useState<number>(() => {
    const saved = localStorage.getItem('screener.topN');
    if (!saved) return 20;
    const parsed = parseInt(saved, 10);
    if (Number.isNaN(parsed)) return 20;
    return Math.min(Math.max(parsed, 1), TOP_N_MAX);
  });
  const [minPrice, setMinPrice] = useState<number>(() => {
    const saved = localStorage.getItem('screener.minPrice');
    return saved ? parseFloat(saved) : 5;
  });
  const [maxPrice, setMaxPrice] = useState<number>(() => {
    const saved = localStorage.getItem('screener.maxPrice');
    return saved ? parseFloat(saved) : 500;
  });
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>(() => {
    const saved = localStorage.getItem('screener.currencyFilter');
    if (saved === 'usd' || saved === 'eur' || saved === 'all') return saved;
    return 'all';
  });
  
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [showBacktestModal, setShowBacktestModal] = useState(false);
  const [showThesisModal, setShowThesisModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<ScreenerCandidate | null>(null);
  const [socialSymbol, setSocialSymbol] = useState<string | null>(null);
  const [recommendationCandidate, setRecommendationCandidate] = useState<ScreenerCandidate | null>(null);

  // Save preferences to localStorage when they change
  const handleUniverseChange = (value: string) => {
    setSelectedUniverse(value);
    localStorage.setItem('screener.universe', value);
  };
  
  const handleTopNChange = (value: number) => {
    const next = Math.min(Math.max(value, 1), TOP_N_MAX);
    setTopN(next);
    localStorage.setItem('screener.topN', next.toString());
  };
  
  const handleMinPriceChange = (value: number) => {
    setMinPrice(value);
    localStorage.setItem('screener.minPrice', value.toString());
  };
  
  const handleMaxPriceChange = (value: number) => {
    setMaxPrice(value);
    localStorage.setItem('screener.maxPrice', value.toString());
  };
  
  const handleCurrencyFilterChange = (value: CurrencyFilter) => {
    setCurrencyFilter(value);
    localStorage.setItem('screener.currencyFilter', value);
  };
  const universesQuery = useUniverses();
  const universesData = universesQuery.data;

  const screenerMutation = useRunScreenerMutation(
    (data) => {
      setLastResult(data);
    },
    (error) => {
      console.error('Screener failed', error);
    },
  );

  const handleRunScreener = () => {
    screenerMutation.mutate({
      universe: selectedUniverse,
      top: topN,
      minPrice: minPrice,
      maxPrice: maxPrice,
      currencies: currencyFilterToRequest(currencyFilter),
      breakoutLookback: config.indicators.breakoutLookback,
      pullbackMa: config.indicators.pullbackMa,
      minHistory: config.indicators.minHistory,
    });
  };

  const result = screenerMutation.data ?? lastResult;
  const candidates = result?.candidates || [];
  const warnings = result?.warnings || [];
  const overlayCounts = candidates.reduce<Record<string, number>>((acc, c) => {
    const status = c.overlayStatus ?? 'OFF';
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t('screener.header.title')}</h1>
        <p className="mt-2 text-gray-600">{t('screener.header.description')}</p>
      </div>

      {/* Controls */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {/* Universe selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('screener.controls.universe')}</label>
            <select
              value={selectedUniverse}
              onChange={(e) => handleUniverseChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={screenerMutation.isPending}
            >
              {universesData?.universes.map((universe) => (
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
              onChange={(e) => handleTopNChange(parseInt(e.target.value) || 20)}
              min="1"
              max={TOP_N_MAX}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={screenerMutation.isPending}
            />
          </div>

          {/* Min Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('screener.controls.minPrice')}</label>
            <input
              type="number"
              value={minPrice}
              onChange={(e) => handleMinPriceChange(parseFloat(e.target.value) || 0)}
              min="0"
              step="0.1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={screenerMutation.isPending}
            />
          </div>

          {/* Max Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('screener.controls.maxPrice')}</label>
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => handleMaxPriceChange(parseFloat(e.target.value) || 1000)}
              min="0"
              step="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={screenerMutation.isPending}
            />
          </div>

          {/* Currency filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('screener.controls.currency')}</label>
            <select
              value={currencyFilter}
              onChange={(e) => handleCurrencyFilterChange(e.target.value as CurrencyFilter)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={screenerMutation.isPending}
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
                {t('screener.controls.account')}: {formatCurrency(riskConfig.accountSize)}
              </div>
              <div>
                {t('screener.controls.risk')}: {formatPercent(riskConfig.riskPct)}
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
              onClick={handleRunScreener}
              disabled={screenerMutation.isPending}
              className="w-full"
            >
              {screenerMutation.isPending ? (
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

        {/* Info banner */}
        {!screenerMutation.isPending && !result && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start">
            <AlertCircle className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <strong>{t('screener.info.noteTitle')}</strong> {t('screener.info.noteBody')}
            </div>
          </div>
        )}

        {/* Error */}
        {screenerMutation.isError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              {t('screener.error.prefix')}: {screenerMutation.error instanceof Error
                ? screenerMutation.error.message
                : t('screener.error.unknown')}
            </p>
          </div>
        )}
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Summary */}
          <Card variant="bordered">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <TrendingUp className="w-6 h-6 text-green-600 mr-2" />
                <div>
                  <p className="text-sm text-gray-600">{t('screener.summary.completed')}</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {t('screener.summary.resultLine', {
                      count: candidates.length,
                      total: result.totalScreened,
                    })}
                  </p>
                  <p className="text-xs text-gray-500">{t('screener.summary.asOf', { date: result.asofDate })}</p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRunScreener}
                title={t('screener.controls.refreshTitle')}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                {t('screener.controls.refresh')}
              </Button>
            </div>
            {warnings.length > 0 && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start">
                <AlertCircle className="w-4 h-4 text-yellow-700 mr-2 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  {warnings.map((warning) => (
                    <div key={warning}>{warning}</div>
                  ))}
                </div>
              </div>
            )}
            {candidates.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {Object.entries(overlayCounts).map(([status, count]) => {
                  return (
                    <span key={status} className="inline-flex items-center gap-1">
                      <OverlayBadge status={status} title={t('screener.table.overlayStatusTitle', { status })} />
                      <span>{count}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Candidates table */}
          <GlossaryLegend
            metricKeys={SCREENER_GLOSSARY_KEYS}
            title={t('screener.glossary.title')}
          />
          <Card>
            <TableShell
              empty={candidates.length === 0}
              emptyMessage={t('screener.table.empty')}
              headers={(
                <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('screener.table.headers.rank')}</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('screener.table.headers.ticker')}</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">{t('screener.table.headers.currency')}</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('screener.table.headers.company')}</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('screener.table.headers.sector')}</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">{t('screener.table.headers.lastBar')}</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                      <MetricHelpLabel
                        metricKey="CONFIDENCE"
                        labelOverride={t('screener.table.headers.signalConfidence')}
                        className="w-full justify-end"
                      />
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">{t('screener.table.headers.close')}</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">{t('screener.table.headers.verdict')}</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                      <MetricHelpLabel metricKey="SCORE" className="w-full justify-end" />
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">{t('screener.table.headers.stop')}</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                      <MetricHelpLabel metricKey="ATR" className="w-full justify-end" />
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">{t('screener.table.headers.riskDollar')}</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                      <MetricHelpLabel metricKey="RR" className="w-full justify-end" />
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                      <MetricHelpLabel metricKey="MOM_6M" className="w-full justify-end" />
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                      <MetricHelpLabel metricKey="MOM_12M" className="w-full justify-end" />
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                      <MetricHelpLabel metricKey="RS" className="w-full justify-end" />
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                      <MetricHelpLabel metricKey="OVERLAY" className="justify-center" />
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">{t('screener.table.headers.fix')}</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">{t('screener.table.headers.actions')}</th>
                  </tr>
              )}
            >
              {candidates.map((candidate) => (
                      <tr key={candidate.ticker} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-900 font-medium">
                          #{candidate.rank}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <a 
                              href={`https://finance.yahoo.com/quote/${candidate.ticker}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                              title={t('screener.table.yahooTickerTitle', { ticker: candidate.ticker })}
                            >
                              {candidate.ticker}
                            </a>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setSocialSymbol(candidate.ticker)}
                              aria-label={t('screener.table.sentimentAria', { ticker: candidate.ticker })}
                              title={t('screener.table.sentimentTitle')}
                            >
                              <MessageSquare className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={
                              candidate.currency === 'EUR'
                                ? 'text-xs px-2 py-1 rounded bg-green-100 text-green-700'
                                : 'text-xs px-2 py-1 rounded bg-blue-100 text-blue-700'
                            }
                          >
                            {candidate.currency}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700">
                          {candidate.name ? (
                            <a 
                              href={`https://finance.yahoo.com/quote/${candidate.ticker}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-blue-600 hover:underline"
                              title={t('screener.table.yahooNameTitle', { name: candidate.name })}
                            >
                              {candidate.name}
                            </a>
                          ) : t('common.placeholders.dash')}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                            {candidate.sector || t('common.placeholders.notAvailable')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-gray-600">
                          {candidate.lastBar
                            ? new Date(candidate.lastBar).toLocaleString()
                            : t('common.placeholders.dash')}
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          <span className="font-semibold text-purple-600">
                            {candidate.confidence.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-gray-900">
                          {formatCurrency(candidate.close, candidate.currency)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {(() => {
                            const verdict = candidate.recommendation?.verdict ?? 'UNKNOWN';
                            return <RecommendationBadge verdict={verdict} className="inline-block" />;
                          })()}
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-medium text-gray-900">
                          {(candidate.score * 100).toFixed(1)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-gray-900">
                          {(() => {
                            const stopValue = candidate.recommendation?.risk?.stop ?? candidate.stop;
                            return stopValue != null && stopValue > 0
                              ? formatCurrency(stopValue, candidate.currency)
                              : t('common.placeholders.dash');
                          })()}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-gray-600">
                          {candidate.atr.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-gray-900">
                          {(() => {
                            const riskValue =
                              candidate.recommendation?.risk?.riskAmount ?? candidate.riskUsd;
                            return riskValue && riskValue > 0
                              ? formatCurrency(riskValue)
                              : t('common.placeholders.dash');
                          })()}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-gray-900">
                          {(() => {
                            const rrValue = candidate.recommendation?.risk?.rr ?? candidate.rr;
                            return rrValue != null && rrValue > 0 ? rrValue.toFixed(2) : t('common.placeholders.dash');
                          })()}
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          <span className={candidate.momentum6m >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatPercent(candidate.momentum6m)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          <span className={candidate.momentum12m >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatPercent(candidate.momentum12m)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          <span className={candidate.relStrength >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatPercent(candidate.relStrength)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {(() => {
                            const reasons = candidate.overlayReasons?.length
                              ? t('screener.table.overlayReasons', {
                                  reasons: candidate.overlayReasons.join(', '),
                                })
                              : t('screener.table.overlayNoTriggers');
                            const metrics = [
                              candidate.overlayAttentionZ != null
                                ? t('screener.table.overlayAttentionZ', {
                                    value: candidate.overlayAttentionZ.toFixed(2),
                                  })
                                : null,
                              candidate.overlaySentimentScore != null
                                ? t('screener.table.overlaySentiment', {
                                    value: candidate.overlaySentimentScore.toFixed(2),
                                  })
                                : null,
                              candidate.overlayHypeScore != null
                                ? t('screener.table.overlayHype', {
                                    value: candidate.overlayHypeScore.toFixed(2),
                                  })
                                : null,
                              candidate.overlaySampleSize != null
                                ? t('screener.table.overlaySample', { value: candidate.overlaySampleSize })
                                : null,
                            ].filter(Boolean);
                            const title = [reasons, ...metrics].join(' | ');
                            return <OverlayBadge status={candidate.overlayStatus} title={title} />;
                          })()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {(() => {
                            const fixes = candidate.recommendation?.education?.whatWouldMakeValid ?? [];
                            if (!fixes.length) return <span className="text-gray-400">{t('common.placeholders.emDash')}</span>;
                            const title = fixes.join(' | ');
                            return (
                              <span
                                className="text-xs text-blue-700 underline decoration-dotted cursor-help"
                                title={title}
                              >
                                {t('screener.table.fixLabel')}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex gap-2 justify-center">
                            {candidate.recommendation?.thesis && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setSelectedCandidate(candidate);
                                  setShowThesisModal(true);
                                }}
                                title="View Trade Thesis"
                                aria-label={`View trade thesis for ${candidate.ticker}`}
                              >
                                <Lightbulb className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setRecommendationCandidate(candidate)}
                              title={t('screener.table.recommendationDetailsTitle')}
                              aria-label={t('screener.table.recommendationDetailsAria', { ticker: candidate.ticker })}
                            >
                              <ListChecks className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setSelectedCandidate(candidate);
                                setShowBacktestModal(true);
                              }}
                              title={t('screener.table.quickBacktestTitle')}
                            >
                              <BarChart3 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => {
                                setSelectedCandidate(candidate);
                                setShowCreateOrderModal(true);
                              }}
                              title={
                                candidate.recommendation?.verdict === 'NOT_RECOMMENDED'
                                  ? t('screener.table.createOrderNotRecommendedTitle')
                                  : t('screener.table.createOrderTitle')
                              }
                            >
                              {t('screener.table.createOrderAction')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
            </TableShell>
          </Card>
        </>
      )}

      {/* Create Order Modal */}
      {showCreateOrderModal && selectedCandidate && (
        <CandidateOrderModal
          candidate={{
            ticker: selectedCandidate.ticker,
            entry: selectedCandidate.entry,
            stop: selectedCandidate.stop,
            close: selectedCandidate.close,
            shares: selectedCandidate.shares,
            recommendation: selectedCandidate.recommendation,
            sector: selectedCandidate.sector ?? null,
            rReward: selectedCandidate.rr,
            score: selectedCandidate.score * 100,
            rank: selectedCandidate.rank,
            atr: selectedCandidate.atr,
            currency: selectedCandidate.currency,
          }}
          risk={riskConfig}
          defaultNotes={t('screener.defaultNotes', {
            score: (selectedCandidate.score * 100).toFixed(1),
            rank: selectedCandidate.rank,
          })}
          onClose={() => {
            setShowCreateOrderModal(false);
            setSelectedCandidate(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.orders() });
            setShowCreateOrderModal(false);
            setSelectedCandidate(null);
          }}
        />
      )}

      {/* Quick Backtest Modal */}
      {showBacktestModal && selectedCandidate && (
        <QuickBacktestModal
          ticker={selectedCandidate.ticker}
          onClose={() => {
            setShowBacktestModal(false);
            setSelectedCandidate(null);
          }}
        />
      )}

      {socialSymbol && (
        <SocialAnalysisModal
          symbol={socialSymbol}
          onClose={() => setSocialSymbol(null)}
        />
      )}

      {/* Trade Thesis Modal */}
      {showThesisModal && selectedCandidate?.recommendation?.thesis && (
        <TradeThesisModal
          thesis={selectedCandidate.recommendation.thesis}
          onClose={() => {
            setShowThesisModal(false);
            setSelectedCandidate(null);
          }}
        />
      )}

      {recommendationCandidate && (
        <RecommendationDetailsModal
          ticker={recommendationCandidate.ticker}
          recommendation={recommendationCandidate.recommendation}
          currency={recommendationCandidate.currency}
          onClose={() => setRecommendationCandidate(null)}
        />
      )}
    </div>
  );
}
