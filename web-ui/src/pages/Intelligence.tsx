import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import Button from '@/components/common/Button';
import IntelligenceOpportunityCard from '@/components/domain/intelligence/IntelligenceOpportunityCard';
import {
  useCreateIntelligenceSymbolSetMutation,
  useDeleteIntelligenceSymbolSetMutation,
  useIntelligenceConfigQuery,
  useIntelligenceOpportunitiesScoped,
  useIntelligenceProvidersQuery,
  useIntelligenceRunStatus,
  useIntelligenceSymbolSetsQuery,
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

  useEffect(() => {
    if (configQuery.data) {
      setDraftConfig(configQuery.data);
    }
  }, [configQuery.data]);

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('intelligencePage.title')}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('intelligencePage.subtitle')}</p>
      </div>

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>{t('intelligencePage.config.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="block text-xs text-gray-500 mb-1">{t('intelligencePage.config.enabled')}</span>
              <input
                type="checkbox"
                checked={draftConfig.enabled}
                onChange={(event) =>
                  setDraftConfig({ ...draftConfig, enabled: event.target.checked })
                }
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-gray-500 mb-1">{t('intelligencePage.config.providers')}</span>
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
                className="w-full rounded border border-gray-300 px-2 py-1"
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-gray-500 mb-1">{t('intelligencePage.config.llmProvider')}</span>
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
                className="w-full rounded border border-gray-300 px-2 py-1"
              >
                <option value="ollama">ollama</option>
                <option value="openai">openai</option>
                <option value="mock">mock</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-xs text-gray-500 mb-1">{t('intelligencePage.config.llmModel')}</span>
              <select
                value={draftConfig.llm.model}
                onChange={(event) =>
                  setDraftConfig({ ...draftConfig, llm: { ...draftConfig.llm, model: event.target.value } })
                }
                className="w-full rounded border border-gray-300 px-2 py-1"
              >
                {llmModelOptions.map((modelName) => (
                  <option key={modelName} value={modelName}>
                    {modelName}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-xs text-gray-500 mb-1">{t('intelligencePage.config.llmBaseUrl')}</span>
              <input
                value={draftConfig.llm.baseUrl}
                onChange={(event) =>
                  setDraftConfig({ ...draftConfig, llm: { ...draftConfig.llm, baseUrl: event.target.value } })
                }
                className="w-full rounded border border-gray-300 px-2 py-1"
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-gray-500 mb-1">{t('intelligencePage.config.llmApiKey')}</span>
              <input
                type="password"
                autoComplete="off"
                value={draftConfig.llm.apiKey}
                onChange={(event) =>
                  setDraftConfig({ ...draftConfig, llm: { ...draftConfig.llm, apiKey: event.target.value } })
                }
                className="w-full rounded border border-gray-300 px-2 py-1"
              />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="block text-xs text-gray-500 mb-1">{t('intelligencePage.config.llmSystemPrompt')}</span>
              <textarea
                value={draftConfig.llm.systemPrompt}
                onChange={(event) =>
                  setDraftConfig({ ...draftConfig, llm: { ...draftConfig.llm, systemPrompt: event.target.value } })
                }
                rows={4}
                placeholder={t('intelligencePage.config.llmSystemPromptPlaceholder')}
                className="w-full rounded border border-gray-300 px-2 py-1 font-mono text-xs"
              />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="block text-xs text-gray-500 mb-1">
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
                className="w-full rounded border border-gray-300 px-2 py-1 font-mono text-xs"
              />
              <p className="mt-1 text-xs text-gray-500">{t('intelligencePage.config.llmPromptTemplateHint')}</p>
            </label>
            <label className="text-sm">
              <span className="block text-xs text-gray-500 mb-1">{t('intelligencePage.config.maxConcurrency')}</span>
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
                className="w-full rounded border border-gray-300 px-2 py-1"
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-gray-500 mb-1">{t('intelligencePage.config.lookbackHours')}</span>
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
                className="w-full rounded border border-gray-300 px-2 py-1"
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-gray-500 mb-1">{t('intelligencePage.config.minScore')}</span>
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
                className="w-full rounded border border-gray-300 px-2 py-1"
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
            <div className="mt-3 text-xs text-gray-500 space-y-1">
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
              className="w-full rounded border border-gray-300 px-2 py-1"
            />
          </label>

          <div className="mt-3">
            <span className="block text-xs text-gray-500 mb-1">{t('intelligencePage.symbols.saved')}</span>
            <select
              value={selectedSymbolSetId}
              onChange={(event) => setSelectedSymbolSetId(event.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1"
            >
              <option value="">{t('intelligencePage.symbols.noneSelected')}</option>
              {symbolSets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.symbols.length})
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={symbolSetName}
              onChange={(event) => setSymbolSetName(event.target.value)}
              placeholder={t('intelligencePage.symbols.setName')}
              className="rounded border border-gray-300 px-2 py-1"
            />
            <input
              value={symbolSetSymbolsInput}
              onChange={(event) => setSymbolSetSymbolsInput(event.target.value)}
              placeholder={t('intelligencePage.symbols.setSymbols')}
              className="rounded border border-gray-300 px-2 py-1"
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
            <Button onClick={runIntelligence} disabled={!canRun || runMutation.isPending}>
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
