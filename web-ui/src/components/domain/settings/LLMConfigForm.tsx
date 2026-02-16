import { useState } from 'react';
import { useConfigStore } from '@/stores/configStore';
import Button from '@/components/common/Button';
import { t } from '@/i18n/t';

const LLM_PROVIDERS = [
  { value: 'openai', label: 'OpenAI (Cloud)', requiresKey: true },
  { value: 'anthropic', label: 'Anthropic Claude (Cloud)', requiresKey: true },
  { value: 'ollama', label: 'Ollama (Local)', requiresKey: false },
  { value: 'mock', label: 'Mock (Testing)', requiresKey: false },
] as const;

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-haiku-20240307',
  ollama: 'mistral:7b-instruct',
  mock: 'mock-classifier',
};

export default function LLMConfigForm() {
  const { config, updateConfig } = useConfigStore();
  const llmConfig = config.market_intelligence?.llm || {};

  const [showApiKey, setShowApiKey] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const currentProvider = llmConfig.provider || 'openai';
  const currentModel = llmConfig.model || DEFAULT_MODELS[currentProvider];
  const currentApiKey = llmConfig.api_key || '';
  const currentBaseUrl = llmConfig.base_url || 'http://localhost:11434';
  const enabled = llmConfig.enabled || false;

  const selectedProvider = LLM_PROVIDERS.find(p => p.value === currentProvider);

  const handleProviderChange = (provider: string) => {
    updateConfig({
      market_intelligence: {
        ...config.market_intelligence,
        llm: {
          ...llmConfig,
          provider,
          model: DEFAULT_MODELS[provider as keyof typeof DEFAULT_MODELS],
        },
      },
    });
    setConnectionStatus('idle');
  };

  const handleModelChange = (model: string) => {
    updateConfig({
      market_intelligence: {
        ...config.market_intelligence,
        llm: {
          ...llmConfig,
          model,
        },
      },
    });
  };

  const handleApiKeyChange = (apiKey: string) => {
    updateConfig({
      market_intelligence: {
        ...config.market_intelligence,
        llm: {
          ...llmConfig,
          api_key: apiKey,
        },
      },
    });
  };

  const handleBaseUrlChange = (baseUrl: string) => {
    updateConfig({
      market_intelligence: {
        ...config.market_intelligence,
        llm: {
          ...llmConfig,
          base_url: baseUrl,
        },
      },
    });
  };

  const handleEnabledChange = (enabled: boolean) => {
    updateConfig({
      market_intelligence: {
        ...config.market_intelligence,
        llm: {
          ...llmConfig,
          enabled,
        },
      },
    });
  };

  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus('idle');
    setErrorMessage('');

    try {
      // TODO: Call API endpoint to test LLM provider availability
      // For now, simulate a test
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Check if API key is required and missing
      if (selectedProvider?.requiresKey && !currentApiKey) {
        throw new Error(`API key required for ${selectedProvider.label}. Please add your API key.`);
      }

      setConnectionStatus('success');
    } catch (error) {
      setConnectionStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Connection test failed');
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div>
          <label className="font-medium text-gray-900 dark:text-white">
            Enable LLM Intelligence
          </label>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Use LLMs to classify news events and generate explanations
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => handleEnabledChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {/* Provider Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          LLM Provider
        </label>
        <select
          value={currentProvider}
          onChange={(e) => handleProviderChange(e.target.value)}
          disabled={!enabled}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {LLM_PROVIDERS.map((provider) => (
            <option key={provider.value} value={provider.value}>
              {provider.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {selectedProvider?.requiresKey
            ? '☁️ Cloud-based provider (requires API key)'
            : '🏠 Local or test provider (no API key needed)'}
        </p>
      </div>

      {/* Model Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Model
        </label>
        <input
          type="text"
          value={currentModel}
          onChange={(e) => handleModelChange(e.target.value)}
          disabled={!enabled}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder={DEFAULT_MODELS[currentProvider as keyof typeof DEFAULT_MODELS]}
        />
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Provider-specific model identifier
        </p>
      </div>

      {/* API Key (for cloud providers) */}
      {selectedProvider?.requiresKey && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            API Key
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={currentApiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              disabled={!enabled}
              className="w-full px-3 py-2 pr-20 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
              placeholder={currentProvider === 'openai' ? 'sk-...' : 'sk-ant-...'}
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              disabled={!enabled}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {showApiKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {currentApiKey
              ? `✓ API key configured (${currentApiKey.length} characters)`
              : `⚠️ API key required. Set ${currentProvider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY'} environment variable or enter here.`}
          </p>
        </div>
      )}

      {/* Base URL (for Ollama) */}
      {currentProvider === 'ollama' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Ollama Base URL
          </label>
          <input
            type="text"
            value={currentBaseUrl}
            onChange={(e) => handleBaseUrlChange(e.target.value)}
            disabled={!enabled}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="http://localhost:11434"
          />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Local Ollama server address
          </p>
        </div>
      )}

      {/* Test Connection Button */}
      <div>
        <Button
          variant="secondary"
          onClick={testConnection}
          disabled={!enabled || testingConnection}
          className="w-full sm:w-auto"
        >
          {testingConnection ? 'Testing Connection...' : 'Test Connection'}
        </Button>

        {/* Connection Status */}
        {connectionStatus !== 'idle' && (
          <div className={`mt-3 p-3 rounded-md ${
            connectionStatus === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
          }`}>
            <p className="text-sm font-medium">
              {connectionStatus === 'success' ? '✓ Connection successful' : '✗ Connection failed'}
            </p>
            {errorMessage && (
              <p className="text-sm mt-1">{errorMessage}</p>
            )}
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
          ℹ️ About LLM Intelligence
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
          <li>LLMs classify news events (EARNINGS, M&A, PRODUCT, etc.)</li>
          <li>Generate beginner-friendly explanations for opportunities</li>
          <li>LLMs interpret data—they never make trading decisions</li>
          <li>Estimated cost: ~$0.01/day with OpenAI gpt-4o-mini</li>
          <li>All outputs cached and logged for transparency</li>
        </ul>
      </div>
    </div>
  );
}
