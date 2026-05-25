import { useMutation, useQuery } from '@tanstack/react-query';
import {
  getCatalystsLatest,
  getCatalystSymbol,
  postCatalystDailyScan,
  postCatalystManual,
} from './api';
import { transformCatalystOpportunity, transformCatalystReport } from './types';
import type { CatalystOpportunity, CatalystReport } from './types';

export function useLatestCatalystReportQuery() {
  return useQuery<CatalystReport, Error>({
    queryKey: ['catalysts', 'latest'],
    queryFn: async () => transformCatalystReport(await getCatalystsLatest()),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSymbolCatalystQuery(ticker: string, enabled: boolean) {
  return useQuery<CatalystOpportunity, Error>({
    queryKey: ['catalysts', 'symbol', ticker],
    queryFn: async () => transformCatalystOpportunity(await getCatalystSymbol(ticker)),
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useManualCatalystReportMutation() {
  return useMutation<CatalystReport, Error, string>({
    mutationFn: async (url: string) => transformCatalystReport(await postCatalystManual(url)),
  });
}

export function useDailyCatalystScanMutation() {
  return useMutation<CatalystReport, Error, void>({
    mutationFn: async () => transformCatalystReport(await postCatalystDailyScan()),
  });
}
