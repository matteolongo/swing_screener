import type { IntelligenceLlmProvider } from '@/features/intelligence/types';

export const PROVIDER_MODELS: Record<IntelligenceLlmProvider, string[]> = {
  ollama: ['mistral:7b-instruct', 'llama3.1:8b-instruct', 'qwen2.5:7b-instruct'],
  openai: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.1', 'o4-mini'],
  mock: ['mock-classifier'],
};

export const PROVIDER_DEFAULTS: Record<
  IntelligenceLlmProvider,
  { model: string; baseUrl: string }
> = {
  ollama: { model: 'mistral:7b-instruct', baseUrl: 'http://localhost:11434' },
  openai: { model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1' },
  mock: { model: 'mock-classifier', baseUrl: '' },
};
