import { useMutation, useQuery } from '@tanstack/react-query';
import { fetchUniverses, runScreener } from './api';
import { ScreenerRequest, ScreenerResponse } from './types';

export function useUniverses() {
  return useQuery({
    queryKey: ['universes'],
    queryFn: fetchUniverses,
  });
}

export function useRunScreenerMutation(
  onSuccess?: (data: ScreenerResponse) => void,
  onError?: (error: unknown) => void,
) {
  return useMutation({
    mutationFn: (request: ScreenerRequest) => runScreener(request),
    onSuccess,
    onError,
  });
}
