import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import type { Position } from '@/types/position';
import { fetchPositions } from './api';

export function usePositionVersion(position: Position) {
  const currentVersion = position.version ?? 1;
  const [reviewed, setReviewed] = useState({ positionId: position.positionId, version: currentVersion });
  // Observe the owner's cached query without starting another refresh on mount.
  const currentPositions = useQuery({
    queryKey: queryKeys.positions('open'),
    queryFn: () => fetchPositions('open'),
    enabled: false,
  });
  const needsReview = reviewed.positionId !== position.positionId || reviewed.version !== currentVersion;
  return {
    expectedVersion: reviewed.version,
    needsReview,
    isUnavailable: currentPositions.isError,
    isRefreshing: currentPositions.isFetching,
    refresh: () => { void currentPositions.refetch(); },
    reviewCurrent: () => setReviewed({ positionId: position.positionId, version: currentVersion }),
    acceptCommitted: (version: number) => setReviewed({ positionId: position.positionId, version }),
  };
}
