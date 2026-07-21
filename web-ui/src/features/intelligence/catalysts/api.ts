import { API_ENDPOINTS } from '@/lib/api';
import { apiFetch } from '@/lib/apiFetch';
import type { CatalystOpportunityAPI, CatalystReportAPI } from './types';

export async function postCatalystManual(url: string): Promise<CatalystReportAPI> {
  const response = await apiFetch(API_ENDPOINTS.catalystsManual, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as { detail?: string }).detail || 'Catalyst report generation failed');
  }
  return response.json() as Promise<CatalystReportAPI>;
}

export async function postCatalystDailyScan(): Promise<CatalystReportAPI> {
  const response = await apiFetch(API_ENDPOINTS.catalystsDailyScan, { method: 'POST' });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as { detail?: string }).detail || 'Daily catalyst scan failed');
  }
  return response.json() as Promise<CatalystReportAPI>;
}

export async function getCatalystsLatest(): Promise<CatalystReportAPI> {
  const response = await apiFetch(API_ENDPOINTS.catalystsLatest);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as { detail?: string }).detail || 'No catalyst report available');
  }
  return response.json() as Promise<CatalystReportAPI>;
}

export async function getCatalystSymbol(ticker: string): Promise<CatalystOpportunityAPI> {
  const response = await apiFetch(API_ENDPOINTS.catalystsSymbol(ticker));
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as { detail?: string }).detail || `No catalyst for ${ticker}`);
  }
  return response.json() as Promise<CatalystOpportunityAPI>;
}
