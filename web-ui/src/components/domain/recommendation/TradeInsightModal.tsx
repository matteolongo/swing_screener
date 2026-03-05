import { useCallback, useEffect, useMemo, useState } from 'react';
import ModalShell from '@/components/common/ModalShell';
import {
  fetchIntelligenceEducation,
  generateIntelligenceEducation,
} from '@/features/intelligence/api';
import type {
  IntelligenceEducationGenerateResponse,
  IntelligenceExplainCandidateContext,
} from '@/features/intelligence/types';
import {
  buildLearnEducationVM,
  buildRecommendationEducationVM,
  buildThesisEducationVM,
} from '@/features/recommendation/educationViewModel';
import type { Recommendation } from '@/types/recommendation';
import { t } from '@/i18n/t';
import RecommendationSection from './sections/RecommendationSection';
import ThesisSection from './sections/ThesisSection';
import LearnSection from './sections/LearnSection';
import { cn } from '@/utils/cn';

interface TradeInsightModalProps {
  ticker: string;
  recommendation?: Recommendation;
  currency?: 'USD' | 'EUR';
  asofDate?: string;
  candidateContext?: IntelligenceExplainCandidateContext;
  defaultTab?: 'recommendation' | 'thesis' | 'learn';
  onClose: () => void;
}

type TabId = 'recommendation' | 'thesis' | 'learn';

interface Tab {
  id: TabId;
  labelKey: string;
  enabled: boolean;
}

export default function TradeInsightModal({
  ticker,
  recommendation,
  currency = 'USD',
  asofDate,
  candidateContext,
  defaultTab = 'recommendation',
  onClose,
}: TradeInsightModalProps) {
  const hasThesis = !!recommendation?.thesis;
  
  // Determine initial tab
  const getInitialTab = (): TabId => {
    if (defaultTab === 'thesis' && hasThesis) return 'thesis';
    if (defaultTab === 'recommendation' && recommendation) return 'recommendation';
    return 'learn';
  };

  const [activeTab, setActiveTab] = useState<TabId>(getInitialTab);
  const [educationStatus, setEducationStatus] = useState<
    'idle' | 'loading' | 'generating' | 'cached' | 'fallback' | 'error'
  >('idle');
  const [educationError, setEducationError] = useState<string | null>(null);
  const [educationData, setEducationData] = useState<IntelligenceEducationGenerateResponse | null>(null);

  const tabs: Tab[] = [
    {
      id: 'recommendation',
      labelKey: 'tradeInsight.tabs.recommendation',
      enabled: !!recommendation,
    },
    {
      id: 'thesis',
      labelKey: 'tradeInsight.tabs.thesis',
      enabled: hasThesis,
    },
    {
      id: 'learn',
      labelKey: 'tradeInsight.tabs.learn',
      enabled: true,
    },
  ];

  const enabledTabs = tabs.filter((tab) => tab.enabled);
  const normalizedTicker = ticker.trim().toUpperCase();

  const requestCandidateContext = useMemo<IntelligenceExplainCandidateContext | undefined>(() => {
    if (candidateContext) {
      return candidateContext;
    }
    if (!recommendation?.risk) {
      return undefined;
    }
    return {
      entry: recommendation.risk.entry,
      stop: recommendation.risk.stop,
      target: recommendation.risk.target,
      rr: recommendation.risk.rr,
    };
  }, [candidateContext, recommendation]);

  const loadEducation = useCallback(
    async (forceRefresh: boolean) => {
      if (!recommendation) {
        return;
      }
      setEducationError(null);
      setEducationStatus(forceRefresh ? 'generating' : 'loading');
      try {
        let response: IntelligenceEducationGenerateResponse;
        if (forceRefresh) {
          response = await generateIntelligenceEducation({
            symbol: normalizedTicker,
            asofDate,
            forceRefresh: true,
            views: ['recommendation', 'thesis', 'learn'],
            candidateContext: requestCandidateContext,
          });
        } else {
          try {
            response = await fetchIntelligenceEducation(normalizedTicker, asofDate);
          } catch {
            response = await generateIntelligenceEducation({
              symbol: normalizedTicker,
              asofDate,
              forceRefresh: false,
              views: ['recommendation', 'thesis', 'learn'],
              candidateContext: requestCandidateContext,
            });
          }
        }
        setEducationData(response);
        setEducationStatus(response.source === 'deterministic_fallback' ? 'fallback' : 'cached');
      } catch (error) {
        setEducationStatus('error');
        setEducationError(error instanceof Error ? error.message : t('common.errors.generic'));
      }
    },
    [asofDate, normalizedTicker, recommendation, requestCandidateContext]
  );

  useEffect(() => {
    setEducationData(null);
    setEducationError(null);
    setEducationStatus('idle');
    if (!recommendation) {
      return;
    }
    void loadEducation(false);
  }, [loadEducation, recommendation]);

  const recommendationEducation = useMemo(
    () =>
      buildRecommendationEducationVM(
        recommendation,
        educationData?.outputs.recommendation ?? recommendation?.thesis?.educationGenerated?.recommendation
      ),
    [educationData?.outputs.recommendation, recommendation]
  );

  const thesisEducation = useMemo(
    () =>
      recommendation?.thesis
        ? buildThesisEducationVM(
            recommendation.thesis,
            educationData?.outputs.thesis ?? recommendation.thesis.educationGenerated?.thesis
          )
        : undefined,
    [educationData?.outputs.thesis, recommendation?.thesis]
  );

  const learnEducation = useMemo(
    () =>
      buildLearnEducationVM(
        recommendation?.thesis,
        educationData?.outputs.learn ?? recommendation?.thesis?.educationGenerated?.learn
      ),
    [educationData?.outputs.learn, recommendation?.thesis]
  );

  const deterministicFacts =
    educationData?.deterministicFacts ?? recommendation?.thesis?.educationGenerated?.deterministicFacts ?? {};

  const educationErrorDetails = educationData?.errors?.map((error) => `${error.view}: ${error.message}`) ?? [];

  return (
    <ModalShell
      title={t('tradeInsight.title', { ticker })}
      onClose={onClose}
      className="max-w-4xl"
      closeAriaLabel={t('modal.closeAria')}
    >
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 -mt-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <nav className="flex gap-1" aria-label={t('tradeInsight.tabsAria')}>
            {enabledTabs.map((tab) => {
              const labelText = tab.id === 'recommendation' 
                ? t('tradeInsight.tabs.recommendation')
                : tab.id === 'thesis'
                ? t('tradeInsight.tabs.thesis')
                : t('tradeInsight.tabs.learn');
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300',
                  )}
                  aria-selected={activeTab === tab.id}
                  role="tab"
                >
                  {labelText}
                </button>
              );
            })}
          </nav>

          {recommendation ? (
            <div className="flex items-center gap-2 pb-1">
              {educationStatus !== 'idle' ? (
                <span
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-xs',
                    educationStatus === 'error'
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : educationStatus === 'fallback'
                        ? 'border-amber-300 bg-amber-50 text-amber-700'
                        : educationStatus === 'generating' || educationStatus === 'loading'
                          ? 'border-blue-300 bg-blue-50 text-blue-700'
                          : 'border-green-300 bg-green-50 text-green-700'
                  )}
                >
                  {educationStatus === 'generating' || educationStatus === 'loading'
                    ? t('tradeInsight.education.statusGenerating')
                    : educationStatus === 'fallback'
                      ? t('tradeInsight.education.statusFallback')
                      : educationStatus === 'error'
                        ? t('tradeInsight.education.statusError')
                        : t('tradeInsight.education.statusCached')}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => void loadEducation(true)}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
              >
                {educationStatus === 'generating'
                  ? t('tradeInsight.education.refreshing')
                  : t('tradeInsight.education.refresh')}
              </button>
            </div>
          ) : null}
        </div>

        {educationStatus === 'error' || educationErrorDetails.length > 0 ? (
          <details className="my-2 rounded-md border border-red-200 bg-red-50 p-2">
            <summary className="cursor-pointer text-xs font-semibold text-red-800">
              {t('tradeInsight.education.whyFailed')}
            </summary>
            {educationError ? <p className="mt-1 text-xs text-red-700">{educationError}</p> : null}
            {educationErrorDetails.length ? (
              <ul className="mt-1 list-disc ml-5 text-xs text-red-700">
                {educationErrorDetails.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </details>
        ) : null}
      </div>

      {/* Tab Content */}
      <div role="tabpanel">
        {activeTab === 'recommendation' && (
          <RecommendationSection
            recommendation={recommendation}
            currency={currency}
            educationView={recommendationEducation}
            deterministicFacts={deterministicFacts}
          />
        )}
        {activeTab === 'thesis' && hasThesis && recommendation?.thesis && (
          <ThesisSection thesis={recommendation.thesis} educationView={thesisEducation} />
        )}
        {activeTab === 'learn' && <LearnSection view={learnEducation} />}
      </div>
    </ModalShell>
  );
}
