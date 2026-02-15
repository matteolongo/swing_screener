import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PlayCircle, RefreshCw, TrendingUp, AlertCircle } from 'lucide-react';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import { useUniverses, useRunScreenerMutation } from '@/features/screener/hooks';
import { ScreenerCandidate } from '@/features/screener/types';
import { useConfigStore } from '@/stores/configStore';
import { RiskConfig } from '@/types/config';
import { useScreenerStore } from '@/stores/screenerStore';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import QuickBacktestModal from '@/components/modals/QuickBacktestModal';
import SocialAnalysisModal from '@/components/modals/SocialAnalysisModal';
import TradeThesisModal from '@/components/modals/TradeThesisModal';
import GlossaryLegend from '@/components/domain/education/GlossaryLegend';
import { SCREENER_GLOSSARY_KEYS } from '@/content/educationGlossary';
import { useActiveStrategyQuery } from '@/features/strategy/hooks';
import OverlayBadge from '@/components/domain/recommendation/OverlayBadge';
import RecommendationDetailsModal from '@/components/domain/recommendation/RecommendationDetailsModal';
import CandidateOrderModal from '@/components/domain/orders/CandidateOrderModal';
import ScreenerCandidatesTable from '@/components/domain/screener/ScreenerCandidatesTable';
import { queryKeys } from '@/lib/queryKeys';
import { t } from '@/i18n/t';
import { fetchSocialWarmupStatus } from '@/features/social/api';
import {
  useIntelligenceOpportunities,
  useIntelligenceRunStatus,
  useRunIntelligenceMutation,
} from '@/features/intelligence/hooks';

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
  const [intelligenceJobId, setIntelligenceJobId] = useState<string>();
  const [intelligenceAsofDate, setIntelligenceAsofDate] = useState<string>();

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
  const intelligenceSymbols = useMemo(
    () =>
      Array.from(
        new Set(candidates.map((candidate) => candidate.ticker).filter((ticker) => ticker && ticker.trim().length > 0))
      ),
    [candidates]
  );
  const runIntelligenceMutation = useRunIntelligenceMutation((launch) => {
    setIntelligenceJobId(launch.jobId);
    setIntelligenceAsofDate(undefined);
  });
  const intelligenceStatusQuery = useIntelligenceRunStatus(intelligenceJobId);
  const intelligenceStatus = intelligenceStatusQuery.data;
  const intelligenceOpportunitiesQuery = useIntelligenceOpportunities(
    intelligenceAsofDate,
    Boolean(intelligenceAsofDate)
  );
  const intelligenceOpportunities = intelligenceOpportunitiesQuery.data?.opportunities ?? [];
  useEffect(() => {
    if (intelligenceStatus?.status === 'completed' && intelligenceStatus.asofDate) {
      setIntelligenceAsofDate(intelligenceStatus.asofDate);
    }
  }, [intelligenceStatus?.asofDate, intelligenceStatus?.status]);
  const handleRunIntelligence = () => {
    if (!intelligenceSymbols.length) {
      return;
    }
    runIntelligenceMutation.mutate({
      symbols: intelligenceSymbols.slice(0, 100),
    });
  };
  const formatScorePercent = (value: number) => `${(value * 100).toFixed(1)}%`;
  const socialWarmupJobId = result?.socialWarmupJobId;
  const socialWarmupQuery = useQuery({
    queryKey: queryKeys.socialWarmupStatus(socialWarmupJobId),
    queryFn: () => fetchSocialWarmupStatus(socialWarmupJobId!),
    enabled: Boolean(socialWarmupJobId),
    refetchInterval: (query) => (query.state.data?.status === 'completed' ? false : 2500),
    retry: false,
  });
  const socialWarmup = socialWarmupQuery.data;
  const resolveOverlayStatus = (status?: string | null) => {
    if (status !== 'PENDING') return status ?? 'OFF';
    return socialWarmup?.status === 'completed' ? 'OFF' : 'PENDING';
  };
  const overlayCounts = candidates.reduce<Record<string, number>>((acc, c) => {
    const status = resolveOverlayStatus(c.overlayStatus);
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
            {socialWarmupJobId && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                {socialWarmup == null
                  ? t('screener.summary.socialWarmupLoading')
                  : socialWarmup.status === 'completed'
                    ? t('screener.summary.socialWarmupCompleted', {
                        completed: socialWarmup.completedSymbols,
                        total: socialWarmup.totalSymbols,
                        ok: socialWarmup.okSymbols,
                        noData: socialWarmup.noDataSymbols,
                        errors: socialWarmup.errorSymbols,
                      })
                    : t('screener.summary.socialWarmupRunning', {
                        completed: socialWarmup.completedSymbols,
                        total: socialWarmup.totalSymbols,
                        ok: socialWarmup.okSymbols,
                        noData: socialWarmup.noDataSymbols,
                        errors: socialWarmup.errorSymbols,
                      })}
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

          <Card variant="bordered">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">{t('screener.intelligence.title')}</h2>
                <p className="text-sm text-gray-600">{t('screener.intelligence.subtitle')}</p>
                <p className="text-xs text-gray-500">
                  {t('screener.intelligence.symbolsLine', {
                    count: intelligenceSymbols.length,
                    symbols:
                      intelligenceSymbols.slice(0, 8).join(', ') || t('screener.intelligence.noneSymbol'),
                  })}
                </p>
              </div>
              <Button
                onClick={handleRunIntelligence}
                disabled={!intelligenceSymbols.length || runIntelligenceMutation.isPending}
              >
                {runIntelligenceMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    {t('screener.intelligence.runningAction')}
                  </>
                ) : (
                  t('screener.intelligence.runAction')
                )}
              </Button>
            </div>

            {runIntelligenceMutation.isError && (
              <p className="mt-3 text-sm text-red-600">
                {t('screener.intelligence.startError', {
                  error:
                    runIntelligenceMutation.error instanceof Error
                      ? runIntelligenceMutation.error.message
                      : t('common.errors.generic'),
                })}
              </p>
            )}

            {intelligenceStatus && (
              <div className="mt-4 rounded-md border border-gray-200 p-3">
                <p className="text-sm font-medium text-gray-900">
                  {intelligenceStatus.status === 'completed' &&
                    t('screener.intelligence.statusCompleted', {
                      completed: intelligenceStatus.completedSymbols,
                      total: intelligenceStatus.totalSymbols,
                      opportunities: intelligenceStatus.opportunitiesCount,
                    })}
                  {intelligenceStatus.status === 'queued' &&
                    t('screener.intelligence.statusQueued', {
                      total: intelligenceStatus.totalSymbols,
                    })}
                  {intelligenceStatus.status === 'running' &&
                    t('screener.intelligence.statusRunning', {
                      completed: intelligenceStatus.completedSymbols,
                      total: intelligenceStatus.totalSymbols,
                    })}
                  {intelligenceStatus.status === 'error' &&
                    t('screener.intelligence.statusError', {
                      error: intelligenceStatus.error || t('common.errors.generic'),
                    })}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {t('screener.intelligence.updatedAt', {
                    updatedAt: intelligenceStatus.updatedAt,
                  })}
                </p>
              </div>
            )}

            {intelligenceStatusQuery.isError && !intelligenceStatus && (
              <p className="mt-3 text-sm text-red-600">
                {t('screener.intelligence.statusLoadError')}
              </p>
            )}

            {intelligenceAsofDate && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    {t('screener.intelligence.opportunitiesTitle', { date: intelligenceAsofDate })}
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => intelligenceOpportunitiesQuery.refetch()}
                    disabled={intelligenceOpportunitiesQuery.isFetching}
                  >
                    {t('screener.intelligence.refreshOpportunities')}
                  </Button>
                </div>

                {intelligenceOpportunitiesQuery.isFetching && (
                  <p className="text-sm text-gray-600">{t('screener.intelligence.loading')}</p>
                )}

                {!intelligenceOpportunitiesQuery.isFetching && intelligenceOpportunities.length === 0 && (
                  <p className="text-sm text-gray-600">{t('screener.intelligence.empty')}</p>
                )}

                {intelligenceOpportunities.length > 0 && (
                  <div className="space-y-2">
                    {intelligenceOpportunities.slice(0, 8).map((opportunity) => (
                      <div key={opportunity.symbol} className="rounded-md border border-gray-200 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="primary">{opportunity.symbol}</Badge>
                            <span className="text-xs text-gray-500">
                              {t('screener.intelligence.stateValue', { state: opportunity.state })}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-green-700">
                            {t('screener.intelligence.opportunityScore', {
                              value: formatScorePercent(opportunity.opportunityScore),
                            })}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-gray-600">
                          {t('screener.intelligence.componentsLine', {
                            technical: formatScorePercent(opportunity.technicalReadiness),
                            catalyst: formatScorePercent(opportunity.catalystStrength),
                          })}
                        </p>
                        {opportunity.explanations[0] && (
                          <p className="mt-1 text-xs text-gray-500">{opportunity.explanations[0]}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Candidates table */}
          <GlossaryLegend
            metricKeys={SCREENER_GLOSSARY_KEYS}
            title={t('screener.glossary.title')}
          />
          <Card>
            <ScreenerCandidatesTable
              candidates={candidates}
              onCreateOrder={(candidate) => {
                setSelectedCandidate(candidate);
                setShowCreateOrderModal(true);
              }}
              onRecommendationDetails={(candidate) => setRecommendationCandidate(candidate)}
              onSocialAnalysis={(ticker) => setSocialSymbol(ticker)}
              onTradeThesis={(candidate) => {
                setSelectedCandidate(candidate);
                setShowThesisModal(true);
              }}
              onQuickBacktest={(candidate) => {
                setSelectedCandidate(candidate);
                setShowBacktestModal(true);
              }}
            />
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
