import { useMutation } from '@tanstack/react-query';

import { runEventStudy } from './api';
import type { BacktestResult, EventStudyRequest } from './types';

export function useRunEventStudyMutation(
  onSuccess?: (data: BacktestResult) => void,
  onError?: (error: unknown) => void,
) {
  return useMutation({
    mutationFn: (request: EventStudyRequest) => runEventStudy(request),
    onSuccess,
    onError,
  });
}
