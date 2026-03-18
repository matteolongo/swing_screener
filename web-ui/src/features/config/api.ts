import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import { type AppConfig, type AppConfigAPI, toAppConfigAPI, transformAppConfig } from '@/types/config';

async function parseConfigResponse(response: Response, fallbackMessage: string): Promise<AppConfig> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || fallbackMessage);
  }
  const payload: AppConfigAPI = await response.json();
  return transformAppConfig(payload);
}

export async function fetchConfig(): Promise<AppConfig> {
  return parseConfigResponse(
    await fetch(apiUrl(API_ENDPOINTS.config)),
    'Failed to fetch app config',
  );
}

export async function fetchConfigDefaults(): Promise<AppConfig> {
  return parseConfigResponse(
    await fetch(apiUrl(API_ENDPOINTS.configDefaults)),
    'Failed to fetch config defaults',
  );
}

export async function updateConfig(config: AppConfig): Promise<AppConfig> {
  return parseConfigResponse(
    await fetch(apiUrl(API_ENDPOINTS.config), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toAppConfigAPI(config)),
    }),
    'Failed to update app config',
  );
}
