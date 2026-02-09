import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlayCircle, RefreshCw, TrendingUp, AlertCircle, BarChart3, MessageSquare } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { API_ENDPOINTS, apiUrl } from '../lib/api';
import { 
  ScreenerRequest, 
  ScreenerResponseAPI,
  ScreenerCandidate,
  UniversesResponse,
  transformScreenerResponse 
} from '../types/screener';
import { CreateOrderRequest, transformCreateOrderRequest } from '../types/order';
import { useConfigStore } from '../stores/configStore';
import { fetchActiveStrategy } from '../lib/strategyApi';
import { StrategyRisk } from '../types/strategy';
import { useScreenerStore } from '../stores/screenerStore';
import { formatCurrency, formatPercent } from '../utils/formatters';
import QuickBacktestModal from '../components/modals/QuickBacktestModal';
import SocialAnalysisModal from '../components/modals/SocialAnalysisModal';

const TOP_N_MAX = 200;
const UNIVERSE_ALIASES: Record<string, string> = {
  mega: 'mega_all',
  mega_defense: 'defense_all',
  mega_healthcare_biotech: 'healthcare_all',
  mega_europe: 'europe_large',
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

export default function Screener() {
  const { config } = useConfigStore();
  const { lastResult, setLastResult } = useScreenerStore();
  const queryClient = useQueryClient();
  const activeStrategyQuery = useQuery({
    queryKey: ['strategy-active'],
    queryFn: fetchActiveStrategy,
  });
  const riskConfig: StrategyRisk = activeStrategyQuery.data?.risk ?? config.risk;
  
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
  
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [showBacktestModal, setShowBacktestModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<ScreenerCandidate | null>(null);
  const [socialSymbol, setSocialSymbol] = useState<string | null>(null);

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

  // Fetch available universes
  const { data: universesData } = useQuery<UniversesResponse>({
    queryKey: ['universes'],
    queryFn: async () => {
      const res = await fetch(apiUrl(API_ENDPOINTS.screenerUniverses));
      if (!res.ok) throw new Error('Failed to fetch universes');
      return res.json();
    },
  });

  // Run screener mutation
  const screenerMutation = useMutation({
    mutationFn: async (request: ScreenerRequest) => {
      // Transform camelCase to snake_case for API
      const apiRequest = {
        universe: request.universe,
        tickers: request.tickers,
        top: request.top,
        asof_date: request.asofDate,
        min_price: request.minPrice,
        max_price: request.maxPrice,
        breakout_lookback: request.breakoutLookback,
        pullback_ma: request.pullbackMa,
        min_history: request.minHistory,
      };
      
      const res = await fetch(apiUrl(API_ENDPOINTS.screenerRun), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiRequest),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Failed to run screener');
      }
      const apiResponse: ScreenerResponseAPI = await res.json();
      return transformScreenerResponse(apiResponse);
    },
    onSuccess: (data) => {
      setLastResult(data);
    },
    onError: (error) => {
      console.error('Screener failed', error);
    },
  });

  const handleRunScreener = () => {
    screenerMutation.mutate({
      universe: selectedUniverse,
      top: topN,
      minPrice: minPrice,
      maxPrice: maxPrice,
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
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
              Error: {screenerMutation.error.message}
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
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Company</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Sector</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Last Bar</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Confidence</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Score</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Close</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">ATR</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Mom 6M</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Mom 12M</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">RS</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Overlay</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="text-center py-8 text-gray-500">
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
                          {formatCurrency(candidate.close)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-gray-600">
                          {candidate.atr.toFixed(2)}
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
                          <div className="flex gap-2 justify-center">
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
  risk: StrategyRisk;
  onClose: () => void;
  onSuccess: () => void;
}) {
  // Calculate suggested stop price (entry - 2*ATR)
  const suggestedStop = candidate.close - (candidate.atr * risk.kAtr);
  
  const overlayRiskMultiplier = candidate.overlayRiskMultiplier ?? 1;
  const overlayMaxPosMultiplier = candidate.overlayMaxPosMultiplier ?? 1;
  const effectiveRiskPct = risk.riskPct * overlayRiskMultiplier;
  const effectiveMaxPositionPct = risk.maxPositionPct * overlayMaxPosMultiplier;

  // Calculate position size based on risk
  const riskPerTrade = risk.accountSize * effectiveRiskPct;
  const riskPerShare = candidate.close - suggestedStop;
  const suggestedShares = riskPerShare > 0 ? Math.floor(riskPerTrade / riskPerShare) : 1;
  const maxShares = Math.floor((risk.accountSize * effectiveMaxPositionPct) / candidate.close);
  const finalShares = Math.max(risk.minShares, Math.min(suggestedShares, maxShares));

  const [formData, setFormData] = useState<CreateOrderRequest>({
    ticker: candidate.ticker,
    orderType: 'BUY_LIMIT',
    quantity: finalShares,
    limitPrice: candidate.close,
    stopPrice: parseFloat(suggestedStop.toFixed(2)),
    notes: `From screener: Score ${(candidate.score * 100).toFixed(1)}, Rank #${candidate.rank}`,
    orderKind: 'entry',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Validation
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
      const response = await fetch(apiUrl(API_ENDPOINTS.orders), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transformCreateOrderRequest(formData)),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create order');
      }

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
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Order'}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
