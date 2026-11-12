import { API_ENDPOINTS } from '@/lib/api';
import { fetchJson } from '@/lib/fetchJson';
import { type AppConfig, type AppConfigAPI, transformAppConfig } from '@/types/config';

export async function fetchConfigDefaults(): Promise<AppConfig> {
  const payload = await fetchJson<AppConfigAPI>(API_ENDPOINTS.configDefaults, {
    errorMessage: 'Failed to fetch config defaults',
  });
  return transformAppConfig(payload);
}

