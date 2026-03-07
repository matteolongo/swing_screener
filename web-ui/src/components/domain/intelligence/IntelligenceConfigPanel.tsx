import Card, { CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import Button from '@/components/common/Button';
import { PROVIDER_DEFAULTS, PROVIDER_MODELS } from '@/content/intelligenceProviders';
import type { IntelligenceConfig, IntelligenceLlmProvider, IntelligenceProviderInfo, IntelligenceProviderTestResponse } from '@/features/intelligence/types';
import { t } from '@/i18n/t';

interface IntelligenceConfigPanelProps {
  draftConfig: IntelligenceConfig;
  llmModelOptions: string[];
  isSaving: boolean;
  isTestingProvider?: boolean;
  testProviderResult: IntelligenceProviderTestResponse | null | undefined;
  providersStatus: IntelligenceProviderInfo[] | null | undefined;
  onConfigChange: (config: IntelligenceConfig) => void;
  onSave: () => void;
  onTestProvider: () => void;
}

export default function IntelligenceConfigPanel({
  draftConfig,
  llmModelOptions,
  isSaving,
  providersStatus,
  testProviderResult,
  onConfigChange,
  onSave,
  onTestProvider,
}: IntelligenceConfigPanelProps) {
  return (
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
              onChange={(event) => onConfigChange({ ...draftConfig, enabled: event.target.checked })}
              aria-label={t('intelligencePage.config.enabled')}
              className="h-5 w-5 rounded border border-gray-300"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-xs text-gray-500">{t('intelligencePage.config.providers')}</span>
            <input
              value={draftConfig.providers.join(', ')}
              onChange={(event) =>
                onConfigChange({
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
                onConfigChange({
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
                onConfigChange({ ...draftConfig, llm: { ...draftConfig.llm, model: event.target.value } })
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
                onConfigChange({ ...draftConfig, llm: { ...draftConfig.llm, baseUrl: event.target.value } })
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
                onConfigChange({ ...draftConfig, llm: { ...draftConfig.llm, apiKey: event.target.value } })
              }
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>

          <label className="text-sm md:col-span-2">
            <span className="mb-1 block text-xs text-gray-500">{t('intelligencePage.config.llmSystemPrompt')}</span>
            <textarea
              value={draftConfig.llm.systemPrompt}
              onChange={(event) =>
                onConfigChange({ ...draftConfig, llm: { ...draftConfig.llm, systemPrompt: event.target.value } })
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
                onConfigChange({
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
                onConfigChange({
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
                onConfigChange({
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
                onConfigChange({
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
                onConfigChange({
                  ...draftConfig,
                  sources: { ...draftConfig.sources, scrapingEnabled: event.target.checked },
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
                onConfigChange({
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
                onConfigChange({
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
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? t('intelligencePage.config.saving') : t('intelligencePage.config.save')}
          </Button>
          <Button variant="secondary" onClick={onTestProvider}>
            {t('intelligencePage.config.testProvider')}
          </Button>
        </div>

        {testProviderResult && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t('intelligencePage.config.providerResult', {
              provider: testProviderResult.provider,
              status: testProviderResult.available ? 'OK' : 'UNAVAILABLE',
            })}
          </p>
        )}

        {providersStatus && (
          <div className="mt-3 space-y-1 text-xs text-gray-500">
            {providersStatus.map((provider) => (
              <p key={provider.provider}>
                {provider.provider}: {provider.available ? 'OK' : 'UNAVAILABLE'}
                {provider.detail ? ` (${provider.detail})` : ''}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
