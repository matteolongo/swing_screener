import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PlayCircle, RefreshCw, TrendingUp, AlertCircle, BarChart3, MessageSquare, ListChecks } from 'lucide-react';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import { useUniverses, useRunScreenerMutation } from '@/features/screener/hooks';
import { ScreenerCandidate } from '@/features/screener/types';
import { CreateOrderRequest } from '@/features/portfolio/types';
import { createOrder } from '@/features/portfolio/api';
import { useConfigStore } from '@/stores/configStore';
import { fetchActiveStrategy } from '@/lib/strategyApi';
import { RiskConfig } from '@/types/config';
import { useScreenerStore } from '@/stores/screenerStore';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import QuickBacktestModal from '@/components/modals/QuickBacktestModal';
import SocialAnalysisModal from '@/components/modals/SocialAnalysisModal';

const TOP_N_MAX = 200;
type CurrencyFilter = 'all' | 'usd' | 'eur';
const UNIVERSE_ALIASES: Record<string, string> = {
  mega: 'mega_all',
  mega_defense: 'defense_all',
  mega_healthcare_biotech: 'healthcare_all',
  mega_europe: 'europe_large',
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
const OVERLAY_BADGES: Record<string, { label: string; className: string }> = {
  OK: { label: 'OK', className: 'bg-green-100 text-green-700' },
  REDUCED_RISK: { label: 'Reduced', className: 'bg-yellow-100 text-yellow-800' },
  REVIEW: { label: 'Review', className: 'bg-orange-100 text-orange-800' },
  VETO: { label: 'Veto', className: 'bg-red-100 text-red-800' },
  NO_DATA: { label: 'No Data', className: 'bg-gray-100 text-gray-600' },
  OFF: { label: 'Off', className: 'bg-gray-100 text-gray-600' },
};
const VERDICT_BADGES: Record<string, { label: string; className: string }> = {
  RECOMMENDED: { label: 'Recommended', className: 'bg-green-100 text-green-800' },
  NOT_RECOMMENDED: { label: 'Not Recommended', className: 'bg-red-100 text-red-800' },
  UNKNOWN: { label: 'No Verdict', className: 'bg-gray-100 text-gray-600' },
};

export default function Screener() {
  const { config } = useConfigStore();
  const { lastResult, setLastResult } = useScreenerStore();
  const queryClient = useQueryClient();
  const activeStrategyQuery = useQuery({
    queryKey: ['strategy-active'],
    queryFn: fetchActiveStrategy,
  });
  const riskConfig: RiskConfig = activeStrategyQuery.data?.risk ?? config.risk;
  
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
        <h1 className="text-3xl font-bold text-gray-900">Screener</h1>
        <p className="mt-2 text-gray-600">
          Find swing trade candidates based on momentum and relative strength
        </p>
      </div>

      {/* Controls */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {/* Universe selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Universe
            </label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Top N
            </label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Min Price
            </label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Price
            </label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency
            </label>
            <select
              value={currencyFilter}
              onChange={(e) => handleCurrencyFilterChange(e.target.value as CurrencyFilter)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={screenerMutation.isPending}
            >
              <option value="all">All</option>
              <option value="usd">USD only</option>
              <option value="eur">EUR only</option>
            </select>
          </div>

          {/* Account info */}
          <div className="flex items-end">
            <div className="text-sm text-gray-600">
              <div>Account: {formatCurrency(riskConfig.accountSize)}</div>
              <div>Risk: {formatPercent(riskConfig.riskPct)}</div>
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
                  Running...
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Run Screener
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
              <strong>Note:</strong> The screener downloads market data and may take 10-30 seconds to complete.
            </div>
          </div>
        )}

        {/* Error */}
        {screenerMutation.isError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              Error: {screenerMutation.error instanceof Error ? screenerMutation.error.message : 'Unknown error'}
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
                  <p className="text-sm text-gray-600">Screener completed</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {candidates.length} candidates from {result.totalScreened} stocks
                  </p>
                  <p className="text-xs text-gray-500">
                    As of: {result.asofDate}
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRunScreener}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
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
                  const badge = OVERLAY_BADGES[status] ?? OVERLAY_BADGES.OFF;
                  return (
                    <span
                      key={status}
                      className={`px-2 py-1 rounded ${badge.className}`}
                      title={`Overlay status: ${status}`}
                    >
                      {badge.label}: {count}
                    </span>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Candidates table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Rank</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Ticker</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Currency</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Company</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Sector</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Last Bar</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Confidence</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Score</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Close</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Stop</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">ATR</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Risk $</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">RR</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Mom 6M</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Mom 12M</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">RS</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Overlay</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Verdict</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Fix</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.length === 0 ? (
                    <tr>
                      <td colSpan={20} className="text-center py-8 text-gray-500">
                        No candidates found
                      </td>
                    </tr>
                  ) : (
                    candidates.map((candidate) => (
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
                              title={`View ${candidate.ticker} on Yahoo Finance`}
                            >
                              {candidate.ticker}
                            </a>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setSocialSymbol(candidate.ticker)}
                              aria-label={`Sentiment for ${candidate.ticker}`}
                              title="Sentiment"
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
                              title={`View ${candidate.name} on Yahoo Finance`}
                            >
                              {candidate.name}
                            </a>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                            {candidate.sector || 'N/A'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-gray-600">
                          {candidate.lastBar
                            ? new Date(candidate.lastBar).toLocaleString()
                            : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          <span className="font-semibold text-purple-600">
                            {candidate.confidence.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-medium text-gray-900">
                          {(candidate.score * 100).toFixed(1)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-gray-900">
                          {formatCurrency(candidate.close, candidate.currency)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-gray-900">
                          {(() => {
                            const stopValue = candidate.recommendation?.risk?.stop ?? candidate.stop;
                            return stopValue != null && stopValue > 0
                              ? formatCurrency(stopValue, candidate.currency)
                              : '-';
                          })()}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-gray-600">
                          {candidate.atr.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-gray-900">
                          {(() => {
                            const riskValue =
                              candidate.recommendation?.risk?.riskAmount ?? candidate.riskUsd;
                            return riskValue && riskValue > 0 ? formatCurrency(riskValue) : '-';
                          })()}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-gray-900">
                          {(() => {
                            const rrValue = candidate.recommendation?.risk?.rr ?? candidate.rr;
                            return rrValue != null && rrValue > 0 ? rrValue.toFixed(2) : '-';
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
                            const status = candidate.overlayStatus ?? 'OFF';
                            const badge = OVERLAY_BADGES[status] ?? OVERLAY_BADGES.OFF;
                            const reasons = candidate.overlayReasons?.length
                              ? `Reasons: ${candidate.overlayReasons.join(', ')}`
                              : 'No overlay triggers';
                            const metrics = [
                              candidate.overlayAttentionZ != null
                                ? `Attention Z: ${candidate.overlayAttentionZ.toFixed(2)}`
                                : null,
                              candidate.overlaySentimentScore != null
                                ? `Sentiment: ${candidate.overlaySentimentScore.toFixed(2)}`
                                : null,
                              candidate.overlayHypeScore != null
                                ? `Hype: ${candidate.overlayHypeScore.toFixed(2)}`
                                : null,
                              candidate.overlaySampleSize != null
                                ? `Sample: ${candidate.overlaySampleSize}`
                                : null,
                            ].filter(Boolean);
                            const title = [reasons, ...metrics].join(' | ');
                            return (
                              <span
                                className={`text-xs px-2 py-1 rounded ${badge.className}`}
                                title={title}
                              >
                                {badge.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {(() => {
                            const verdict = candidate.recommendation?.verdict ?? 'UNKNOWN';
                            const badge = VERDICT_BADGES[verdict] ?? VERDICT_BADGES.UNKNOWN;
                            const reasons = candidate.recommendation?.reasonsShort?.length
                              ? candidate.recommendation.reasonsShort.join(' | ')
                              : 'No recommendation available';
                            return (
                              <span
                                className={`text-xs px-2 py-1 rounded ${badge.className}`}
                                title={reasons}
                              >
                                {badge.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {(() => {
                            const fixes = candidate.recommendation?.education?.whatWouldMakeValid ?? [];
                            if (!fixes.length) return <span className="text-gray-400">—</span>;
                            const title = fixes.join(' | ');
                            return (
                              <span
                                className="text-xs text-blue-700 underline decoration-dotted cursor-help"
                                title={title}
                              >
                                Fix
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setRecommendationCandidate(candidate)}
                              title="Recommendation details"
                              aria-label={`Recommendation details for ${candidate.ticker}`}
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
                              title="Quick Backtest"
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
                                  ? 'Not recommended — open details to fix'
                                  : 'Create Order'
                              }
                            >
                              Create Order
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Create Order Modal */}
      {showCreateOrderModal && selectedCandidate && (
        <CreateOrderModal
          candidate={selectedCandidate}
          risk={riskConfig}
          onClose={() => {
            setShowCreateOrderModal(false);
            setSelectedCandidate(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['orders'] });
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

      {recommendationCandidate && (
        <RecommendationModal
          candidate={recommendationCandidate}
          onClose={() => setRecommendationCandidate(null)}
        />
      )}
    </div>
  );
}

function RecommendationModal({
  candidate,
  onClose,
}: {
  candidate: ScreenerCandidate;
  onClose: () => void;
}) {
  const rec = candidate.recommendation;
  const verdict = rec?.verdict ?? 'NOT_RECOMMENDED';
  const verdictBadge = VERDICT_BADGES[verdict] ?? VERDICT_BADGES.NOT_RECOMMENDED;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card variant="elevated" className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Recommendation — {candidate.ticker}</h2>
            <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
          </div>

          <div className={`p-4 rounded ${verdict === 'RECOMMENDED' ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded ${verdictBadge.className}`}>
                {verdictBadge.label}
              </span>
              <span className="text-sm text-gray-700">Summary</span>
            </div>
            {rec?.reasonsShort?.length ? (
              <ul className="list-disc ml-5 mt-2 space-y-1 text-sm">
                {rec.reasonsShort.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-gray-700 mt-2">
                No recommendation details available.
              </div>
            )}
          </div>

          <details className="bg-white rounded border border-gray-200 p-4" open>
            <summary className="cursor-pointer font-semibold">Checklist Gates</summary>
            <div className="mt-3 space-y-2 text-sm">
              {rec?.checklist?.length ? rec.checklist.map((gate) => (
                <div key={gate.gateName} className="flex items-start gap-3">
                  <span className={`mt-0.5 h-2 w-2 rounded-full ${gate.passed ? 'bg-green-600' : 'bg-red-600'}`} />
                  <div>
                    <div className="font-medium">{gate.gateName}</div>
                    <div className="text-gray-600">{gate.explanation}</div>
                  </div>
                </div>
              )) : (
                <div className="text-gray-600">No checklist data.</div>
              )}
            </div>
          </details>

          <details className="bg-white rounded border border-gray-200 p-4">
            <summary className="cursor-pointer font-semibold">Risk & Costs</summary>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-gray-500">Entry</div>
                <div className="font-semibold">
                  {rec?.risk?.entry != null ? formatCurrency(rec.risk.entry, candidate.currency) : '—'}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Stop</div>
                <div className="font-semibold">
                  {rec?.risk?.stop != null ? formatCurrency(rec.risk.stop, candidate.currency) : '—'}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Target</div>
                <div className="font-semibold">
                  {rec?.risk?.target != null ? formatCurrency(rec.risk.target, candidate.currency) : '—'}
                </div>
              </div>
              <div>
                <div className="text-gray-500">RR</div>
                <div className="font-semibold">{rec?.risk?.rr != null ? rec.risk.rr.toFixed(2) : '—'}</div>
              </div>
              <div>
                <div className="text-gray-500">Risk Amount</div>
                <div className="font-semibold">{rec?.risk?.riskAmount != null ? formatCurrency(rec.risk.riskAmount) : '—'}</div>
              </div>
              <div>
                <div className="text-gray-500">Risk %</div>
                <div className="font-semibold">{rec?.risk?.riskPct != null ? formatPercent(rec.risk.riskPct) : '—'}</div>
              </div>
              <div>
                <div className="text-gray-500">Position Size</div>
                <div className="font-semibold">{rec?.risk?.positionSize != null ? formatCurrency(rec.risk.positionSize) : '—'}</div>
              </div>
              <div>
                <div className="text-gray-500">Shares</div>
                <div className="font-semibold">{rec?.risk?.shares != null ? rec.risk.shares : '—'}</div>
              </div>
              <div>
                <div className="text-gray-500">Fees (est.)</div>
                <div className="font-semibold">{rec?.costs?.totalCost != null ? formatCurrency(rec.costs.totalCost) : '—'}</div>
              </div>
              <div>
                <div className="text-gray-500">Fee / Risk</div>
                <div className="font-semibold">{rec?.costs?.feeToRiskPct != null ? formatPercent(rec.costs.feeToRiskPct) : '—'}</div>
              </div>
            </div>
          </details>

          <details className="bg-white rounded border border-gray-200 p-4">
            <summary className="cursor-pointer font-semibold">Education</summary>
            <div className="mt-3 text-sm space-y-2">
              <div>
                <div className="text-gray-500">Bias Warning</div>
                <div className="font-medium">{rec?.education?.commonBiasWarning ?? '—'}</div>
              </div>
              <div>
                <div className="text-gray-500">What to Learn</div>
                <div className="font-medium">{rec?.education?.whatToLearn ?? '—'}</div>
              </div>
              {rec?.education?.whatWouldMakeValid?.length ? (
                <div>
                  <div className="text-gray-500">What would make this trade valid?</div>
                  <ul className="list-disc ml-5 mt-1 space-y-1">
                    {rec.education.whatWouldMakeValid.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </details>
        </div>
      </Card>
    </div>
  );
}

// Create Order Modal Component
function CreateOrderModal({
  candidate,
  risk,
  onClose,
  onSuccess,
}: {
  candidate: ScreenerCandidate;
  risk: RiskConfig;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const recRisk = candidate.recommendation?.risk;
  const suggestedEntry = recRisk?.entry ?? candidate.entry ?? candidate.close;
  const suggestedStop = recRisk?.stop ?? candidate.stop ?? null;
  const suggestedShares = recRisk?.shares ?? candidate.shares ?? risk.minShares;

  const [formData, setFormData] = useState<CreateOrderRequest>({
    ticker: candidate.ticker,
    orderType: 'BUY_LIMIT',
    quantity: suggestedShares,
    limitPrice: parseFloat(suggestedEntry.toFixed(2)),
    stopPrice: suggestedStop != null ? parseFloat(suggestedStop.toFixed(2)) : 0,
    notes: `From screener: Score ${(candidate.score * 100).toFixed(1)}, Rank #${candidate.rank}`,
    orderKind: 'entry',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verdict = candidate.recommendation?.verdict ?? 'NOT_RECOMMENDED';
  const isRecommended = verdict === 'RECOMMENDED';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Validation
    if (!isRecommended) {
      setError('This setup is not recommended. Review the checklist and fix the issues first.');
      setIsSubmitting(false);
      return;
    }
    if (formData.quantity <= 0) {
      setError('Quantity must be greater than 0');
      setIsSubmitting(false);
      return;
    }
    if (!formData.limitPrice || formData.limitPrice <= 0) {
      setError('Limit price must be greater than 0');
      setIsSubmitting(false);
      return;
    }
    if (formData.stopPrice && formData.limitPrice <= formData.stopPrice) {
      setError('Limit price must be higher than stop price');
      setIsSubmitting(false);
      return;
    }

    try {
      await createOrder(formData);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const positionSize = (formData.limitPrice || 0) * formData.quantity;
  const riskAmount = formData.stopPrice ? (formData.limitPrice! - formData.stopPrice) * formData.quantity : 0;
  const riskPercent = risk.accountSize > 0 ? (riskAmount / risk.accountSize) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card variant="elevated" className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">Create Order - {candidate.ticker}</h2>
          
          {/* Candidate Summary */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded mb-4">
            <h3 className="font-semibold mb-2">Candidate Details</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Price:</span>{' '}
                <strong>{formatCurrency(candidate.close)}</strong>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">ATR:</span>{' '}
                <strong>{candidate.atr.toFixed(2)}</strong>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Momentum 6M:</span>{' '}
                <strong className={candidate.momentum6m >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatPercent(candidate.momentum6m)}
                </strong>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Score:</span>{' '}
                <strong>{(candidate.score * 100).toFixed(1)}</strong>
              </div>
            </div>
          </div>

          {/* Recommendation Summary */}
          <div className={`p-4 rounded mb-4 ${isRecommended ? 'bg-green-50' : 'bg-red-50'}`}>
            <h3 className="font-semibold mb-2">Recommendation</h3>
            <div className="text-sm">
              <div className="font-semibold">
                {isRecommended ? 'Recommended' : 'Not Recommended'}
              </div>
              {candidate.recommendation?.reasonsShort?.length ? (
                <ul className="list-disc ml-5 mt-2 space-y-1">
                  {candidate.recommendation.reasonsShort.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <div className="mt-2 text-gray-700">No recommendation details available.</div>
              )}
              {candidate.recommendation?.education?.whatWouldMakeValid?.length ? (
                <div className="mt-3">
                  <div className="font-medium">What would make it valid?</div>
                  <ul className="list-disc ml-5 mt-1 space-y-1">
                    {candidate.recommendation.education.whatWouldMakeValid.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Order Type</label>
                <select
                  value={formData.orderType}
                  onChange={(e) => setFormData({ ...formData, orderType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                >
                  <option value="BUY_LIMIT">BUY LIMIT</option>
                  <option value="BUY_MARKET">BUY MARKET</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Limit Price</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.limitPrice}
                  onChange={(e) => setFormData({ ...formData, limitPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Stop Price</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.stopPrice}
                  onChange={(e) => setFormData({ ...formData, stopPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                  required
                />
              </div>
            </div>

            {/* Risk Summary */}
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded">
              <h3 className="font-semibold mb-2">Position Summary</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Position Size:</span>{' '}
                  <strong>{formatCurrency(positionSize)}</strong>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">% of Account:</span>{' '}
                  <strong>{risk.accountSize > 0 ? ((positionSize / risk.accountSize) * 100).toFixed(1) : '0.0'}%</strong>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Risk Amount:</span>{' '}
                  <strong className="text-red-600">{formatCurrency(riskAmount)}</strong>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Risk %:</span>{' '}
                  <strong className={riskPercent > risk.riskPct * 100 ? 'text-red-600' : 'text-green-600'}>
                    {riskPercent.toFixed(2)}%
                  </strong>
                </div>
              </div>
              {riskPercent > risk.riskPct * 100 && (
                <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-2">
                  ⚠️ Risk exceeds target ({(risk.riskPct * 100).toFixed(1)}%)
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                rows={3}
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isSubmitting || !isRecommended}>
                {isSubmitting ? 'Creating...' : 'Create Order'}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
