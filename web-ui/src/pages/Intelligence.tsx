import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import Button from '@/components/common/Button';
import IntelligenceOpportunityCard from '@/components/domain/intelligence/IntelligenceOpportunityCard';
import {
  useCreateIntelligenceSymbolSetMutation,
  useDeleteIntelligenceSymbolSetMutation,
  useIntelligenceConfigQuery,
  useIntelligenceEventsQuery,
  useIntelligenceOpportunitiesScoped,
  useIntelligenceProvidersQuery,
  useIntelligenceRunStatus,
  useIntelligenceSourcesHealthQuery,
  useIntelligenceSymbolSetsQuery,
  useIntelligenceUpcomingCatalystsQuery,
  useRunIntelligenceMutation,
  useTestIntelligenceProviderMutation,
  useUpdateIntelligenceConfigMutation,
  useUpdateIntelligenceSymbolSetMutation,
} from '@/features/intelligence/hooks';
import type {
  IntelligenceConfig,
  IntelligenceLlmProvider,
  IntelligenceRunRequest,
} from '@/features/intelligence/types';
import { t } from '@/i18n/t';

function normalizeSymbols(input: string): string[] {
  const seen = new Set<string>();
  return input
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

const PROVIDER_MODELS: Record<IntelligenceLlmProvider, string[]> = {
  ollama: ['mistral:7b-instruct', 'llama3.1:8b-instruct', 'qwen2.5:7b-instruct'],
  openai: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.1', 'o4-mini'],
  mock: ['mock-classifier'],
};

const PROVIDER_DEFAULTS: Record<IntelligenceLlmProvider, { model: string; baseUrl: string }> = {
  ollama: { model: 'mistral:7b-instruct', baseUrl: 'http://localhost:11434' },
  openai: { model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1' },
  mock: { model: 'mock-classifier', baseUrl: '' },
};

export default function IntelligencePage() {
  const navigate = useNavigate();
  const configQuery = useIntelligenceConfigQuery();
  const providersQuery = useIntelligenceProvidersQuery();
  const symbolSetsQuery = useIntelligenceSymbolSetsQuery();

  const updateConfigMutation = useUpdateIntelligenceConfigMutation();
  const createSymbolSetMutation = useCreateIntelligenceSymbolSetMutation();
  const updateSymbolSetMutation = useUpdateIntelligenceSymbolSetMutation();
  const deleteSymbolSetMutation = useDeleteIntelligenceSymbolSetMutation();
  const testProviderMutation = useTestIntelligenceProviderMutation();

  const [draftConfig, setDraftConfig] = useState<IntelligenceConfig | null>(null);
  const [jobId, setJobId] = useState<string>();
  const [asofDate, setAsofDate] = useState<string>();
  const [manualSymbolsInput, setManualSymbolsInput] = useState('');
  const [selectedSymbolSetId, setSelectedSymbolSetId] = useState('');
  const [symbolSetName, setSymbolSetName] = useState('');
  const [symbolSetSymbolsInput, setSymbolSetSymbolsInput] = useState('');
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.localStorage.getItem('intelligence.showAdvancedConfig') === 'true';
  });

  useEffect(() => {
    if (configQuery.data) {
      setDraftConfig(configQuery.data);
    }
  }, [configQuery.data]);

  useEffect(() => {
    window.localStorage.setItem('intelligence.showAdvancedConfig', String(showAdvancedConfig));
  }, [showAdvancedConfig]);

  const symbolSets = symbolSetsQuery.data?.items ?? [];
  const selectedSymbolSet = symbolSets.find((item) => item.id === selectedSymbolSetId);
  const manualSymbols = useMemo(() => normalizeSymbols(manualSymbolsInput), [manualSymbolsInput]);
  const llmModelOptions = useMemo(() => {
    if (!draftConfig) return [];
    const provider = draftConfig.llm.provider;
    const options = PROVIDER_MODELS[provider] ?? [];
    if (!draftConfig.llm.model) {
      return options;
    }
    return options.includes(draftConfig.llm.model) ? options : [draftConfig.llm.model, ...options];
  }, [draftConfig]);

  useEffect(() => {
    if (selectedSymbolSet) {
      setSymbolSetName(selectedSymbolSet.name);
      setSymbolSetSymbolsInput(selectedSymbolSet.symbols.join(', '));
    }
  }, [selectedSymbolSet]);

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
  const upcomingCatalysts = upcomingQuery.data?.items ?? [];
  const sourceHealthItems = sourcesHealthQuery.data?.sources ?? [];
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

  const createSymbolSet = () => {
    const symbols = normalizeSymbols(symbolSetSymbolsInput);
    if (!symbolSetName.trim() || symbols.length === 0) return;
    createSymbolSetMutation.mutate(
      { name: symbolSetName.trim(), symbols },
      {
        onSuccess: (created) => {
          setSelectedSymbolSetId(created.id);
        },
      }
    );
  };

  const updateSymbolSet = () => {
    if (!selectedSymbolSetId) return;
    const symbols = normalizeSymbols(symbolSetSymbolsInput);
    if (!symbolSetName.trim() || symbols.length === 0) return;
    updateSymbolSetMutation.mutate({
      id: selectedSymbolSetId,
      payload: { name: symbolSetName.trim(), symbols },
    });
  };

  const deleteSymbolSet = (id: string) => {
    deleteSymbolSetMutation.mutate(id, {
      onSuccess: () => {
        if (selectedSymbolSetId === id) {
          setSelectedSymbolSetId('');
          setSymbolSetName('');
          setSymbolSetSymbolsInput('');
        }
      },
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
            <Button onClick={createSymbolSetMutation.isPending ? undefined : createSymbolSet}>
              {t('intelligencePage.symbols.createSet')}
            </Button>
            <Button variant="secondary" onClick={updateSymbolSetMutation.isPending ? undefined : updateSymbolSet}>
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
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>{t('intelligencePage.config.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-xs text-gray-500">{t('intelligencePage.config.enabled')}</span>
                <input
                  type="checkbox"
                  checked={draftConfig.enabled}
                  onChange={(event) =>
                    setDraftConfig({ ...draftConfig, enabled: event.target.checked })
                  }
                  aria-label={t('intelligencePage.config.enabled')}
                  className="h-5 w-5 rounded border border-gray-300"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs text-gray-500">{t('intelligencePage.config.providers')}</span>
                <input
                  value={draftConfig.providers.join(', ')}
                  onChange={(event) =>
                    setDraftConfig({
                      ...draftConfig,
                      providers: event.target.value
                        .split(',')
                        .map((value) => value.trim().toLowerCase())
                        .filter((value, index, list) => value && list.indexOf(value) === index),
                    })
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs text-gray-500">{t('intelligencePage.config.llmProvider')}</span>
                <select
                  value={draftConfig.llm.provider}
                  onChange={(event) => {
                    const nextProvider = event.target.value as IntelligenceLlmProvider;
                    const defaults = PROVIDER_DEFAULTS[nextProvider];
                    const nextModel = PROVIDER_MODELS[nextProvider].includes(draftConfig.llm.model)
                      ? draftConfig.llm.model
                      : defaults.model;
                    setDraftConfig({
                      ...draftConfig,
                      llm: {
                        ...draftConfig.llm,
                        provider: nextProvider,
                        model: nextModel,
                        baseUrl: defaults.baseUrl,
                      },
                    });
                  }}
                  aria-label={t('intelligencePage.config.llmProvider')}
                  className="w-full rounded border border-gray-300 px-3 py-2"
                >
                  <option value="ollama">ollama</option>
                  <option value="openai">openai</option>
                  <option value="mock">mock</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs text-gray-500">{t('intelligencePage.config.llmModel')}</span>
                <select
                  value={draftConfig.llm.model}
                  onChange={(event) =>
                    setDraftConfig({ ...draftConfig, llm: { ...draftConfig.llm, model: event.target.value } })
                  }
                  aria-label={t('intelligencePage.config.llmModel')}
                  className="w-full rounded border border-gray-300 px-3 py-2"
                >
                  {llmModelOptions.map((modelName) => (
                    <option key={modelName} value={modelName}>
                      {modelName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs text-gray-500">{t('intelligencePage.config.llmBaseUrl')}</span>
                <input
                  value={draftConfig.llm.baseUrl}
                  onChange={(event) =>
                    setDraftConfig({ ...draftConfig, llm: { ...draftConfig.llm, baseUrl: event.target.value } })
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs text-gray-500">{t('intelligencePage.config.llmApiKey')}</span>
                <input
                  type="password"
                  autoComplete="off"
                  value={draftConfig.llm.apiKey}
                  onChange={(event) =>
                    setDraftConfig({ ...draftConfig, llm: { ...draftConfig.llm, apiKey: event.target.value } })
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-xs text-gray-500">{t('intelligencePage.config.llmSystemPrompt')}</span>
                <textarea
                  value={draftConfig.llm.systemPrompt}
                  onChange={(event) =>
                    setDraftConfig({ ...draftConfig, llm: { ...draftConfig.llm, systemPrompt: event.target.value } })
                  }
                  rows={4}
                  placeholder={t('intelligencePage.config.llmSystemPromptPlaceholder')}
                  className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs"
                />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-xs text-gray-500">
                  {t('intelligencePage.config.llmUserPromptTemplate')}
                </span>
                <textarea
                  value={draftConfig.llm.userPromptTemplate}
                  onChange={(event) =>
                    setDraftConfig({
                      ...draftConfig,
                      llm: { ...draftConfig.llm, userPromptTemplate: event.target.value },
                    })
                  }
                  rows={8}
                  placeholder={t('intelligencePage.config.llmUserPromptTemplatePlaceholder')}
                  className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs"
                />
                <p className="mt-1 text-xs text-gray-500">{t('intelligencePage.config.llmPromptTemplateHint')}</p>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs text-gray-500">{t('intelligencePage.config.maxConcurrency')}</span>
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={draftConfig.llm.maxConcurrency}
                  onChange={(event) =>
                    setDraftConfig({
                      ...draftConfig,
                      llm: {
                        ...draftConfig.llm,
                        maxConcurrency: Math.max(1, Math.min(16, Number(event.target.value) || 1)),
                      },
                    })
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs text-gray-500">{t('intelligencePage.config.lookbackHours')}</span>
                <input
                  type="number"
                  min={1}
                  value={draftConfig.catalyst.lookbackHours}
                  onChange={(event) =>
                    setDraftConfig({
                      ...draftConfig,
                      catalyst: {
                        ...draftConfig.catalyst,
                        lookbackHours: Math.max(1, Number(event.target.value) || 1),
                      },
                    })
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs text-gray-500">{t('intelligencePage.config.minScore')}</span>
                <input
                  type="number"
                  step={0.01}
                  min={0}
                  max={1}
                  value={draftConfig.opportunity.minOpportunityScore}
                  onChange={(event) =>
                    setDraftConfig({
                      ...draftConfig,
                      opportunity: {
                        ...draftConfig.opportunity,
                        minOpportunityScore: Math.max(0, Math.min(1, Number(event.target.value) || 0)),
                      },
                    })
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs text-gray-500">Enable fallback scraping</span>
                <input
                  type="checkbox"
                  checked={draftConfig.sources.scrapingEnabled}
                  onChange={(event) =>
                    setDraftConfig({
                      ...draftConfig,
                      sources: {
                        ...draftConfig.sources,
                        scrapingEnabled: event.target.checked,
                      },
                    })
                  }
                  className="h-5 w-5 rounded border border-gray-300"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs text-gray-500">Allowed domains (comma-separated)</span>
                <input
                  value={draftConfig.sources.allowedDomains.join(', ')}
                  onChange={(event) =>
                    setDraftConfig({
                      ...draftConfig,
                      sources: {
                        ...draftConfig.sources,
                        allowedDomains: event.target.value
                          .split(',')
                          .map((value) => value.trim().toLowerCase())
                          .filter((value, index, list) => value && list.indexOf(value) === index),
                      },
                    })
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs text-gray-500">Binary event window (days)</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={draftConfig.calendar.binaryEventWindowDays}
                  onChange={(event) =>
                    setDraftConfig({
                      ...draftConfig,
                      calendar: {
                        ...draftConfig.calendar,
                        binaryEventWindowDays: Math.max(1, Math.min(30, Number(event.target.value) || 1)),
                      },
                    })
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={saveConfig} disabled={updateConfigMutation.isPending}>
                {updateConfigMutation.isPending ? t('intelligencePage.config.saving') : t('intelligencePage.config.save')}
              </Button>
              <Button variant="secondary" onClick={testProvider}>
                {t('intelligencePage.config.testProvider')}
              </Button>
            </div>

            {testProviderMutation.data && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {t('intelligencePage.config.providerResult', {
                  provider: testProviderMutation.data.provider,
                  status: testProviderMutation.data.available ? 'OK' : 'UNAVAILABLE',
                })}
              </p>
            )}

            {providersQuery.data && (
              <div className="mt-3 space-y-1 text-xs text-gray-500">
                {providersQuery.data.map((provider) => (
                  <p key={provider.provider}>
                    {provider.provider}: {provider.available ? 'OK' : 'UNAVAILABLE'}
                    {provider.detail ? ` (${provider.detail})` : ''}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
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
