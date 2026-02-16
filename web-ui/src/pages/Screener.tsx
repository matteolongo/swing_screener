import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import Card from '@/components/common/Card';
import { useUniverses, useRunScreenerMutation } from '@/features/screener/hooks';
import { ScreenerCandidate } from '@/features/screener/types';
import { useConfigStore } from '@/stores/configStore';
import { RiskConfig } from '@/types/config';
import { useScreenerStore } from '@/stores/screenerStore';
import { useBeginnerModeStore } from '@/stores/beginnerModeStore';
import QuickBacktestModal from '@/components/modals/QuickBacktestModal';
import SocialAnalysisModal from '@/components/modals/SocialAnalysisModal';
import GlossaryLegend from '@/components/domain/education/GlossaryLegend';
import { SCREENER_GLOSSARY_KEYS } from '@/content/educationGlossary';
import { useActiveStrategyQuery } from '@/features/strategy/hooks';
import TradeInsightModal from '@/components/domain/recommendation/TradeInsightModal';
import CandidateOrderModal from '@/components/domain/orders/CandidateOrderModal';
import ScreenerCandidatesTable from '@/components/domain/screener/ScreenerCandidatesTable';
import ScreenerForm from '@/components/domain/screener/ScreenerForm';
import ScreenerResultsHeader from '@/components/domain/screener/ScreenerResultsHeader';
import IntelligencePanel from '@/components/domain/screener/IntelligencePanel';
import { queryKeys } from '@/lib/queryKeys';
import { t } from '@/i18n/t';
import { fetchSocialWarmupStatus } from '@/features/social/api';
import {
  useRunIntelligenceMutation,
  useIntelligenceRunStatus,
  useIntelligenceOpportunitiesScoped,
} from '@/features/intelligence/hooks';
import { useLocalStorage, useModal } from '@/hooks';

const TOP_N_MAX = 200;
const INTELLIGENCE_ASOF_STORAGE_KEY = 'screener.intelligenceAsofDate';
const INTELLIGENCE_SYMBOLS_STORAGE_KEY = 'screener.intelligenceSymbols';
type CurrencyFilter = 'all' | 'usd' | 'eur';

const UNIVERSE_ALIASES: Record<string, string> = {
  mega: 'usd_all',
  mega_all: 'usd_all',
  mega_stocks: 'usd_mega_stocks',
  core_etfs: 'usd_core_etfs',
  defense_all: 'usd_defense_all',
  defense_stocks: 'usd_defense_stocks',
  defense_etfs: 'usd_defense_etfs',
  healthcare_all: 'usd_healthcare_all',
  healthcare_stocks: 'usd_healthcare_stocks',
  healthcare_etfs: 'usd_healthcare_etfs',
  mega_defense: 'usd_defense_all',
  mega_healthcare_biotech: 'usd_healthcare_all',
  mega_europe: 'eur_europe_large',
  europe_large: 'eur_europe_large',
  amsterdam_all: 'eur_amsterdam_all',
  amsterdam_aex: 'eur_amsterdam_aex',
  amsterdam_amx: 'eur_amsterdam_amx',
};

const normalizeCurrencies = (currencies?: string[]): ('USD' | 'EUR')[] => {
  const normalized = (currencies ?? [])
    .map((value) => value.toUpperCase())
    .filter((value): value is 'USD' | 'EUR' => value === 'USD' || value === 'EUR');
  return normalized.length ? Array.from(new Set(normalized)) : ['USD', 'EUR'];
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

function getApiErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error == null || !('status' in error)) {
    return undefined;
  }
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

export default function Screener() {
  const { config } = useConfigStore();
  const { lastResult, setLastResult } = useScreenerStore();
  const { isBeginnerMode } = useBeginnerModeStore();
  const queryClient = useQueryClient();
  const activeStrategyQuery = useActiveStrategyQuery();
  const riskConfig: RiskConfig = activeStrategyQuery.data?.risk ?? config.risk;
  const activeCurrencies = normalizeCurrencies(activeStrategyQuery.data?.universe?.filt?.currencies);
  
  // Screener form state with localStorage persistence
  const [selectedUniverse, setSelectedUniverse] = useLocalStorage('screener.universe', 'usd_all', (val: unknown) => {
    const normalized = normalizeUniverse(typeof val === 'string' ? val : null);
    return normalized ?? 'usd_all';
  });
  const [topN, setTopN] = useLocalStorage('screener.topN', 20, (val: unknown) => {
    const parsed = typeof val === 'number' ? val : parseInt(String(val), 10);
    if (Number.isNaN(parsed)) return 20;
    return Math.min(Math.max(parsed, 1), TOP_N_MAX);
  });
  const [minPrice, setMinPrice] = useLocalStorage('screener.minPrice', 5);
  const [maxPrice, setMaxPrice] = useLocalStorage('screener.maxPrice', 500);
  const [currencyFilter, setCurrencyFilter] = useLocalStorage<CurrencyFilter>('screener.currencyFilter', 'all', (val: unknown) => {
    if (val === 'usd' || val === 'eur' || val === 'all') return val;
    return 'all';
  });
  const [recommendedOnly, setRecommendedOnly] = useLocalStorage('screener.recommendedOnly', false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useLocalStorage('screener.showAdvancedFilters', !isBeginnerMode);
  
  // Modal state
  const createOrderModal = useModal<ScreenerCandidate>();
  const backtestModal = useModal<ScreenerCandidate>();
  const socialModal = useModal<string>();
  const insightModal = useModal<{ candidate: ScreenerCandidate; defaultTab: 'recommendation' | 'thesis' | 'learn' }>();


  // Intelligence state
  const [intelligenceJobId, setIntelligenceJobId] = useState<string | null>(null);
  const [intelligenceAsofDate, setIntelligenceAsofDate] = useLocalStorage(
    INTELLIGENCE_ASOF_STORAGE_KEY,
    '',
    (val: unknown) => (val && String(val).trim().length > 0 ? String(val) : '')
  );
  const [intelligenceSymbols, setIntelligenceSymbols] = useLocalStorage<string[]>(
    INTELLIGENCE_SYMBOLS_STORAGE_KEY,
    [],
    (val: unknown) => {
      if (!Array.isArray(val)) return [];
      return val
        .map((v) => String(v).trim().toUpperCase())
        .filter((v) => v.length > 0);
    }
  );
  const intelligenceStatus = useIntelligenceRunStatus(intelligenceJobId ?? undefined);
  const intelligenceOpportunities = useIntelligenceOpportunitiesScoped(
    intelligenceAsofDate || undefined,
    intelligenceSymbols.length > 0 ? intelligenceSymbols : undefined,
    Boolean(intelligenceAsofDate)
  );

  const universesQuery = useUniverses();
  const universesData = universesQuery.data;

  const screenerMutation = useRunScreenerMutation(
    (data) => {
      setLastResult(data);
      setIntelligenceJobId(null);
      setIntelligenceAsofDate('');
      setIntelligenceSymbols([]);
    },
    (error) => {
      console.error('Screener failed', error);
    },
  );

  const intelligenceMutation = useRunIntelligenceMutation((data) => {
    setIntelligenceJobId(data.jobId);
    setIntelligenceAsofDate('');
  });

  useEffect(() => {
    if (intelligenceStatus.data?.status !== 'completed' || !intelligenceStatus.data.asofDate) {
      return;
    }
    setIntelligenceAsofDate(intelligenceStatus.data.asofDate);
  }, [intelligenceStatus.data?.asofDate, intelligenceStatus.data?.status, setIntelligenceAsofDate]);

  const handleRunIntelligence = () => {
    const symbols = candidates.map((c) => c.ticker);
    if (!symbols.length) {
      return;
    }
    setIntelligenceSymbols(symbols);
    intelligenceMutation.mutate({ symbols });
  };

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
  const allCandidates = result?.candidates || [];
  // Apply recommended-only filter in UI
  const candidates = recommendedOnly
    ? allCandidates.filter((c) => {
        const verdict = c.recommendation?.verdict ?? 'UNKNOWN';
        return verdict === 'RECOMMENDED';
      })
    : allCandidates;
  const warnings = result?.warnings || [];
  const socialWarmupJobId = result?.socialWarmupJobId;
  const socialWarmupQuery = useQuery({
    queryKey: queryKeys.socialWarmupStatus(socialWarmupJobId),
    queryFn: () => fetchSocialWarmupStatus(socialWarmupJobId!),
    enabled: Boolean(socialWarmupJobId),
    refetchInterval: (query) => {
      const status = getApiErrorStatus(query.state.error);
      if (status === 404) return false;
      return query.state.data?.status === 'completed' ? false : 2500;
    },
    retry: false,
  });
  const socialWarmup = socialWarmupQuery.data;
  const socialWarmupErrorStatus = getApiErrorStatus(socialWarmupQuery.error);
  const socialWarmupNotFound = socialWarmupErrorStatus === 404;
  const resolveOverlayStatus = (status?: string | null) => {
    if (status !== 'PENDING') return status ?? 'OFF';
    if (socialWarmupNotFound) return 'OFF';
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
      <ScreenerForm
        isBeginnerMode={isBeginnerMode}
        selectedUniverse={selectedUniverse}
        setSelectedUniverse={setSelectedUniverse}
        topN={topN}
        setTopN={setTopN}
        minPrice={minPrice}
        setMinPrice={setMinPrice}
        maxPrice={maxPrice}
        setMaxPrice={setMaxPrice}
        currencyFilter={currencyFilter}
        setCurrencyFilter={setCurrencyFilter}
        recommendedOnly={recommendedOnly}
        setRecommendedOnly={setRecommendedOnly}
        showAdvancedFilters={showAdvancedFilters}
        setShowAdvancedFilters={setShowAdvancedFilters}
        universes={universesData?.universes || []}
        isLoading={screenerMutation.isPending}
        accountSize={riskConfig.accountSize}
        riskPct={riskConfig.riskPct}
        activeCurrencies={activeCurrencies}
        onRun={handleRunScreener}
      />

      {/* Info banner */}
      {!screenerMutation.isPending && !result && (
        <Card>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start">
            <AlertCircle className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <strong>{t('screener.info.noteTitle')}</strong> {t('screener.info.noteBody')}
            </div>
          </div>
        </Card>
      )}

      {/* Error */}
      {screenerMutation.isError && (
        <Card>
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              {t('screener.error.prefix')}: {screenerMutation.error instanceof Error
                ? screenerMutation.error.message
                : t('screener.error.unknown')}
            </p>
          </div>
        </Card>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary */}
          <ScreenerResultsHeader
            candidatesCount={candidates.length}
            allCandidatesCount={allCandidates.length}
            totalScreened={result.totalScreened}
            asofDate={result.asofDate}
            isFiltered={recommendedOnly}
            warnings={warnings}
            socialWarmupJobId={socialWarmupJobId}
            socialWarmup={socialWarmup}
            socialWarmupNotFound={socialWarmupNotFound}
            overlayCounts={overlayCounts}
            onRefresh={handleRunScreener}
          />

          {/* Intelligence Section */}
          <IntelligencePanel
            hasCandidates={candidates.length > 0}
            intelligenceAsofDate={intelligenceAsofDate}
            intelligenceJobId={intelligenceJobId}
            intelligenceStatus={intelligenceStatus}
            intelligenceOpportunities={intelligenceOpportunities}
            isRunningIntelligence={intelligenceMutation.isPending}
            onRunIntelligence={handleRunIntelligence}
          />

          {/* Candidates table */}
          <GlossaryLegend
            metricKeys={SCREENER_GLOSSARY_KEYS}
            title={t('screener.glossary.title')}
          />
          <Card>
            <ScreenerCandidatesTable
              candidates={candidates}
              onCreateOrder={(candidate) => {
                createOrderModal.open(candidate);
              }}
              onRecommendationDetails={(candidate) => {
                insightModal.open({ candidate, defaultTab: 'recommendation' });
              }}
              onSocialAnalysis={(ticker) => socialModal.open(ticker)}
              onTradeThesis={(candidate) => {
                insightModal.open({ candidate, defaultTab: 'thesis' });
              }}
              onQuickBacktest={(candidate) => {
                backtestModal.open(candidate);
              }}
            />
          </Card>
        </>
      )}

      {/* Create Order Modal */}
      {createOrderModal.isOpen && createOrderModal.data && (
        <CandidateOrderModal
          candidate={{
            ticker: createOrderModal.data.ticker,
            entry: createOrderModal.data.entry,
            stop: createOrderModal.data.stop,
            close: createOrderModal.data.close,
            shares: createOrderModal.data.shares,
            recommendation: createOrderModal.data.recommendation,
            sector: createOrderModal.data.sector ?? null,
            rReward: createOrderModal.data.rr,
            score: createOrderModal.data.score * 100,
            rank: createOrderModal.data.rank,
            atr: createOrderModal.data.atr,
            currency: createOrderModal.data.currency,
          }}
          risk={riskConfig}
          defaultNotes={t('screener.defaultNotes', {
            score: (createOrderModal.data.score * 100).toFixed(1),
            rank: createOrderModal.data.rank,
          })}
          onClose={createOrderModal.close}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.orders() });
            createOrderModal.close();
          }}
        />
      )}

      {/* Quick Backtest Modal */}
      {backtestModal.isOpen && backtestModal.data && (
        <QuickBacktestModal
          ticker={backtestModal.data.ticker}
          onClose={backtestModal.close}
        />
      )}

      {socialModal.isOpen && socialModal.data && (
        <SocialAnalysisModal
          symbol={socialModal.data}
          onClose={socialModal.close}
        />
      )}

      {/* Trade Insight Modal - Unified recommendation + thesis */}
      {insightModal.isOpen && insightModal.data && (
        <TradeInsightModal
          ticker={insightModal.data.candidate.ticker}
          recommendation={insightModal.data.candidate.recommendation}
          currency={insightModal.data.candidate.currency}
          defaultTab={insightModal.data.defaultTab}
          onClose={insightModal.close}
        />
      )}
    </div>
  );
}
