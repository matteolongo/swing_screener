import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { queryKeys } from '@/lib/queryKeys';
import { invalidateOrderLifecycleQueries } from './queryInvalidation';

describe('invalidateOrderLifecycleQueries', () => {
  it('marks cached review and position reads stale after an order fill', async () => {
    const queryClient = new QueryClient();
    const reviewKey = queryKeys.dailyReview(0, 'portfolio');
    const positionsKey = queryKeys.positions('open');
    queryClient.setQueryData(reviewKey, { summary: {} });
    queryClient.setQueryData(positionsKey, []);

    await invalidateOrderLifecycleQueries(queryClient, true);

    expect(queryClient.getQueryState(reviewKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(positionsKey)?.isInvalidated).toBe(true);
  });
});
