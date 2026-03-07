import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import Button from '@/components/common/Button';
import IntelligenceOpportunityCard from '@/components/domain/intelligence/IntelligenceOpportunityCard';
import IntelligenceConfigPanel from '@/components/domain/intelligence/IntelligenceConfigPanel';
import {
  useIntelligenceConfigQuery,
  useIntelligenceEventsQuery,
  useIntelligenceMetricsQuery,
  useIntelligenceOpportunitiesScoped,
  useIntelligenceProvidersQuery,
  useIntelligenceRunStatus,
  useIntelligenceSourcesHealthQuery,
  useIntelligenceUpcomingCatalystsQuery,
  useRunIntelligenceMutation,
  useTestIntelligenceProviderMutation,
  useUpdateIntelligenceConfigMutation,
} from '@/features/intelligence/hooks';
import type {
  IntelligenceConfig,
  IntelligenceRunRequest,
} from '@/features/intelligence/types';
import { useIntelligenceSymbolSetEditor } from '@/features/intelligence/useIntelligenceSymbolSetEditor';
import { PROVIDER_MODELS } from '@/content/intelligenceProviders';
import { t } from '@/i18n/t';


export default function IntelligencePage() {
  const navigate = useNavigate();
  const configQuery = useIntelligenceConfigQuery();
  const providersQuery = useIntelligenceProvidersQuery();
  const updateConfigMutation = useUpdateIntelligenceConfigMutation();
  const testProviderMutation = useTestIntelligenceProviderMutation();

  const [draftConfig, setDraftConfig] = useState<IntelligenceConfig | null>(null);
  const [jobId, setJobId] = useState<string>();
  const [asofDate, setAsofDate] = useState<string>();
  const [manualSymbolsInput, setManualSymbolsInput] = useState('');
  const [showAdvancedConfig, setShowAdvancedConfig] = useLocalStorage(
    'intelligence.showAdvancedConfig',
    false,
    // Handle both legacy raw-string ("true") and new JSON (true) formats
    (val) => val === true || val === 'true',
  );
  const {
    symbolSets,
    selectedSymbolSetId,
    setSelectedSymbolSetId,
    selectedSymbolSet,
    symbolSetName,
    setSymbolSetName,
    symbolSetSymbolsInput,
    setSymbolSetSymbolsInput,
    createSymbolSet,
    updateSymbolSet,
    deleteSymbolSet,
    isCreating: isCreatingSymbolSet,
    isUpdating: isUpdatingSymbolSet,
  } = useIntelligenceSymbolSetEditor();

  useEffect(() => {
    if (configQuery.data) {
      setDraftConfig(configQuery.data);
    }
  }, [configQuery.data]);

  const manualSymbols = useMemo(
    () => manualSymbolsInput
      .split(',')
      .map((v) => v.trim().toUpperCase())
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i),
    [manualSymbolsInput],
  );
  const llmModelOptions = useMemo(() => {
    if (!draftConfig) return [];
    const provider = draftConfig.llm.provider;
    const options = PROVIDER_MODELS[provider] ?? [];
    if (!draftConfig.llm.model) {
      return options;
    }
    return options.includes(draftConfig.llm.model) ? options : [draftConfig.llm.model, ...options];
  }, [draftConfig]);

  const runMutation = useRunIntelligenceMutation((launch) => {
    setJobId(launch.jobId);
    setAsofDate(undefined);
  });
  const statusQuery = useIntelligenceRunStatus(jobId);
  const status = statusQuery.data;

  useEffect(() => {
    if (status?.status === 'completed' && status.asofDate) {
      setAsofDate(status.asofDate);
    }
  }, [status?.asofDate, status?.status]);

  const opportunityScope = manualSymbols.length
    ? manualSymbols
    : selectedSymbolSet?.symbols ?? [];

  const opportunitiesQuery = useIntelligenceOpportunitiesScoped(
    asofDate,
    opportunityScope,
    Boolean(asofDate)
  );
  const opportunities = opportunitiesQuery.data?.opportunities ?? [];
  const upcomingQuery = useIntelligenceUpcomingCatalystsQuery(
    asofDate,
    opportunityScope,
    14,
    Boolean(asofDate)
  );
  const eventsQuery = useIntelligenceEventsQuery(
    asofDate,
    opportunityScope,
    undefined,
    0.5,
    Boolean(asofDate)
  );
  const sourcesHealthQuery = useIntelligenceSourcesHealthQuery(true);
  const metricsQuery = useIntelligenceMetricsQuery(asofDate, Boolean(asofDate));
  const upcomingCatalysts = upcomingQuery.data?.items ?? [];
  const sourceHealthItems = sourcesHealthQuery.data?.sources ?? [];
  const intelligenceMetrics = metricsQuery.data;
  const hasOpportunities = opportunities.length > 0;

  const canRun = manualSymbols.length > 0 || Boolean(selectedSymbolSetId);

  const saveConfig = () => {
    if (!draftConfig) return;
    updateConfigMutation.mutate(draftConfig);
  };

  const runIntelligence = () => {
    const payload: IntelligenceRunRequest = manualSymbols.length
      ? { symbols: manualSymbols }
      : { symbolSetId: selectedSymbolSetId };
    runMutation.mutate(payload);
  };

  const testProvider = () => {
    if (!draftConfig) return;
    testProviderMutation.mutate({
      provider: draftConfig.llm.provider,
      model: draftConfig.llm.model,
      baseUrl: draftConfig.llm.baseUrl,
      apiKey: draftConfig.llm.apiKey,
    });
  };


  if (configQuery.isLoading || !draftConfig) {
    return <div className="text-sm text-gray-600 dark:text-gray-400">{t('intelligencePage.loading')}</div>;
  }

  if (configQuery.isError) {
    return <div className="text-sm text-red-600 dark:text-red-400">{t('intelligencePage.loadError')}</div>;
  }

  return (
    <div className="space-y-6 pb-28 md:pb-0">
      <div>
        <h1 className="text-2xl font-bold">{t('intelligencePage.title')}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('intelligencePage.subtitle')}</p>
      </div>

      <Card variant="bordered" className="border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20">
        <CardHeader className="mb-3">
          <CardTitle>{t('intelligencePage.quickStart.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="space-y-1 text-sm text-gray-700 dark:text-gray-200">
            <li>{t('intelligencePage.quickStart.step1')}</li>
            <li>{t('intelligencePage.quickStart.step2')}</li>
            <li>{t('intelligencePage.quickStart.step3')}</li>
          </ol>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowAdvancedConfig((current) => !current)}
          >
            {showAdvancedConfig
              ? t('intelligencePage.config.hideAdvanced')
              : t('intelligencePage.config.showAdvanced')}
          </Button>
        </CardContent>
      </Card>

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>{t('intelligencePage.symbols.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="text-sm block">
            <span className="block text-xs text-gray-500 mb-1">{t('intelligencePage.symbols.manual')}</span>
            <input
              value={manualSymbolsInput}
              onChange={(event) => setManualSymbolsInput(event.target.value)}
              placeholder="AAPL, MSFT, NVDA"
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>

          <label className="mt-3 block text-sm">
            <span className="block text-xs text-gray-500 mb-1">{t('intelligencePage.symbols.saved')}</span>
            <select
              value={selectedSymbolSetId}
              onChange={(event) => setSelectedSymbolSetId(event.target.value)}
              aria-label={t('intelligencePage.symbols.saved')}
              className="w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="">{t('intelligencePage.symbols.noneSelected')}</option>
              {symbolSets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.symbols.length})
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={symbolSetName}
              onChange={(event) => setSymbolSetName(event.target.value)}
              placeholder={t('intelligencePage.symbols.setName')}
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
            <input
              value={symbolSetSymbolsInput}
              onChange={(event) => setSymbolSetSymbolsInput(event.target.value)}
              placeholder={t('intelligencePage.symbols.setSymbols')}
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={isCreatingSymbolSet ? undefined : createSymbolSet}>
              {t('intelligencePage.symbols.createSet')}
            </Button>
            <Button variant="secondary" onClick={isUpdatingSymbolSet ? undefined : updateSymbolSet}>
              {t('intelligencePage.symbols.updateSet')}
            </Button>
            {selectedSymbolSetId && (
              <Button variant="danger" onClick={() => deleteSymbolSet(selectedSymbolSetId)}>
                {t('intelligencePage.symbols.deleteSet')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>{t('intelligencePage.run.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 items-center">
            <Button onClick={runIntelligence} disabled={!canRun || runMutation.isPending} className="w-full sm:w-auto">
              {runMutation.isPending ? t('intelligencePage.run.running') : t('intelligencePage.run.run')}
            </Button>
            <span className="text-xs text-gray-500">{t('intelligencePage.run.scopeHint')}</span>
          </div>

          {status && (
            <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">
              {t('intelligencePage.run.statusLine', {
                status: status.status,
                completed: status.completedSymbols,
                total: status.totalSymbols,
                opportunities: status.opportunitiesCount,
              })}
            </div>
          )}

          {status?.status === 'completed' && hasOpportunities ? (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
              <p className="text-sm text-emerald-900 dark:text-emerald-200">
                {t('intelligencePage.run.openWorkspaceHint', { count: opportunities.length })}
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-2 w-full sm:w-auto"
                onClick={() => navigate('/workspace')}
              >
                {t('intelligencePage.run.openWorkspace')}
              </Button>
            </div>
          ) : null}

          {status && status.llmWarningsCount > 0 && (
            <div className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <p>
                {t('intelligencePage.run.llmWarningsLine', {
                  count: status.llmWarningsCount,
                })}
              </p>
              {status.llmWarningSample && (
                <p className="mt-1 text-xs">
                  {t('intelligencePage.run.llmWarningSample', {
                    sample: status.llmWarningSample,
                  })}
                </p>
              )}
            </div>
          )}

          {status?.analysisSummary && (
            <div className="mt-2 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              <p className="font-medium">{t('intelligencePage.run.analysisSummaryTitle')}</p>
              <p className="mt-1 text-sm">{status.analysisSummary}</p>
            </div>
          )}

          {statusQuery.isFetching && (
            <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              {t('intelligencePage.run.polling')}
            </div>
          )}

          {asofDate && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold">
                {t('intelligencePage.run.opportunitiesTitle', { date: asofDate })}
              </p>
              {opportunitiesQuery.isFetching && (
                <p className="text-sm text-gray-500">{t('intelligencePage.run.loadingOpportunities')}</p>
              )}
              {!opportunitiesQuery.isFetching && opportunities.length === 0 && (
                <p className="text-sm text-gray-500">{t('intelligencePage.run.emptyOpportunities')}</p>
              )}
              <div className="space-y-2">
                {opportunities.map((opportunity) => (
                  <IntelligenceOpportunityCard key={opportunity.symbol} opportunity={opportunity} />
                ))}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-3 dark:border-indigo-900 dark:bg-indigo-950/20">
                  <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">Upcoming Catalysts (14d)</p>
                  {upcomingQuery.isFetching ? (
                    <p className="mt-2 text-xs text-indigo-700/80 dark:text-indigo-200/80">Loading upcoming events...</p>
                  ) : upcomingCatalysts.length === 0 ? (
                    <p className="mt-2 text-xs text-indigo-700/80 dark:text-indigo-200/80">No scheduled catalysts in window.</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-xs text-indigo-900 dark:text-indigo-100">
                      {upcomingCatalysts.slice(0, 6).map((item, index) => (
                        <li key={`${item.symbol}-${item.eventAt}-${index}`}>
                          {item.symbol} • {item.eventType} • {new Date(item.eventAt).toLocaleDateString()} • m=
                          {item.materiality.toFixed(2)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-lg border border-cyan-200 bg-cyan-50/70 p-3 dark:border-cyan-900 dark:bg-cyan-950/20">
                  <p className="text-sm font-semibold text-cyan-900 dark:text-cyan-100">Source Health</p>
                  {sourcesHealthQuery.isFetching ? (
                    <p className="mt-2 text-xs text-cyan-800/80 dark:text-cyan-200/80">Loading sources...</p>
                  ) : sourceHealthItems.length === 0 ? (
                    <p className="mt-2 text-xs text-cyan-800/80 dark:text-cyan-200/80">No source health available yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-xs text-cyan-900 dark:text-cyan-100">
                      {sourceHealthItems.slice(0, 8).map((source) => (
                        <li key={source.sourceName}>
                          {source.sourceName}: {source.status} • events {source.eventCount} • err {source.errorCount}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900 dark:bg-amber-950/20">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Evidence Quality Metrics</p>
                {metricsQuery.isFetching ? (
                  <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-200/80">Loading metrics...</p>
                ) : !intelligenceMetrics ? (
                  <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-200/80">No metrics available yet.</p>
                ) : (
                  <div className="mt-2 space-y-1 text-xs text-amber-900 dark:text-amber-100">
                    <p>Coverage: {intelligenceMetrics.coverageGlobal.toFixed(2)}</p>
                    <p>Mean confidence: {intelligenceMetrics.meanConfidenceGlobal.toFixed(2)}</p>
                    <p>Dedupe ratio: {intelligenceMetrics.dedupeRatio.toFixed(2)}</p>
                    {(
                      intelligenceMetrics.coverageGlobal < 0.2 ||
                      intelligenceMetrics.meanConfidenceGlobal < 0.45
                    ) && (
                      <p className="font-semibold text-red-700 dark:text-red-300">
                        Warning: low evidence quality, treat ranking with caution.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-900/30">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Recent Events (materiality ≥ 0.5)</p>
                {eventsQuery.isFetching ? (
                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">Loading events...</p>
                ) : (eventsQuery.data?.events ?? []).length === 0 ? (
                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">No normalized events for this scope.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-xs text-gray-700 dark:text-gray-200">
                    {(eventsQuery.data?.events ?? []).slice(0, 8).map((event) => (
                      <li key={event.eventId}>
                        {event.symbol} • {event.eventType}/{event.eventSubtype} • conf {event.confidence.toFixed(2)} • src {event.sourceName}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showAdvancedConfig ? (
        <IntelligenceConfigPanel
          draftConfig={draftConfig}
          llmModelOptions={llmModelOptions}
          isSaving={updateConfigMutation.isPending}
          testProviderResult={testProviderMutation.data}
          providersStatus={providersQuery.data}
          onConfigChange={setDraftConfig}
          onSave={saveConfig}
          onTestProvider={testProvider}
        />
      ) : null}

      <div
        className="fixed inset-x-0 z-30 border-t border-gray-200 bg-white/95 px-3 py-3 shadow-[0_-8px_20px_rgba(0,0,0,0.08)] md:hidden dark:border-gray-700 dark:bg-gray-900/95"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 5.2rem)' }}
      >
        <div className="mx-auto max-w-5xl">
          <Button
            onClick={runIntelligence}
            disabled={!canRun || runMutation.isPending}
            className="w-full"
          >
            {runMutation.isPending ? t('intelligencePage.run.running') : t('intelligencePage.run.run')}
          </Button>
          <p className="mt-1 text-center text-[11px] text-gray-500">
            {canRun ? t('intelligencePage.run.mobileStickyReady') : t('intelligencePage.run.mobileStickyHint')}
          </p>
        </div>
      </div>
    </div>
  );
}
