import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteSymbolNote, fetchSymbolNote, upsertSymbolNote } from './api';

export function useSymbolNote(ticker: string | null | undefined) {
  return useQuery({
    queryKey: ['symbol-note', ticker?.toUpperCase() ?? null],
    queryFn: () => fetchSymbolNote(ticker as string),
    enabled: !!ticker,
  });
}

export function useUpsertSymbolNoteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticker, note }: { ticker: string; note: string }) =>
      upsertSymbolNote(ticker, note),
    onSuccess: (_, { ticker }) => {
      queryClient.invalidateQueries({ queryKey: ['symbol-note', ticker.toUpperCase()] });
    },
  });
}

export function useDeleteSymbolNoteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ticker: string) => deleteSymbolNote(ticker),
    onSuccess: (_, ticker) => {
      queryClient.invalidateQueries({ queryKey: ['symbol-note', ticker.toUpperCase()] });
    },
  });
}
