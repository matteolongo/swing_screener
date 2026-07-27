import { API_ENDPOINTS } from '@/lib/api';
import { fetchJson } from '@/lib/fetchJson';
import {
  assertVolumeAnalysisIdentity,
  transformVolumeAnalysis,
  type VolumeAnalysis,
  type VolumeAnalysisAPI,
} from './types';

export async function fetchVolumeAnalysis(
  ticker: string,
  lookback: number,
  minRr: number,
): Promise<VolumeAnalysis> {
  const query = new URLSearchParams({ lookback: String(lookback), min_rr: String(minRr) });
  const raw = await fetchJson<VolumeAnalysisAPI>(`${API_ENDPOINTS.volumeAnalysis(ticker)}?${query.toString()}`, {
    errorMessage: `Failed to fetch volume analysis for ${ticker}`,
  });
  const analysis = transformVolumeAnalysis(raw);
  assertVolumeAnalysisIdentity(analysis, ticker, lookback, minRr);
  return analysis;
}
