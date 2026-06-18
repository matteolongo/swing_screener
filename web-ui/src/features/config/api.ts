import { API_ENDPOINTS } from '@/lib/api';
import { fetchJson } from '@/lib/fetchJson';
import { type AppConfig, type AppConfigAPI, toAppConfigAPI, transformAppConfig } from '@/types/config';

export async function fetchConfig(): Promise<AppConfig> {
  const payload = await fetchJson<AppConfigAPI>(API_ENDPOINTS.config, {
    errorMessage: 'Failed to fetch app config',
  });
  return transformAppConfig(payload);
}

export async function fetchConfigDefaults(): Promise<AppConfig> {
  const payload = await fetchJson<AppConfigAPI>(API_ENDPOINTS.configDefaults, {
    errorMessage: 'Failed to fetch config defaults',
  });
  return transformAppConfig(payload);
}

export async function updateConfig(config: AppConfig): Promise<AppConfig> {
  const payload = await fetchJson<AppConfigAPI>(API_ENDPOINTS.config, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toAppConfigAPI(config)),
    errorMessage: 'Failed to update app config',
  });
  return transformAppConfig(payload);
}
