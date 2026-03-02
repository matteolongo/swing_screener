import { useMemo } from 'react';
import { usePositions } from '@/features/portfolio/hooks';

export function usePortfolio() {
  const positionsQuery = usePositions('all');

  const positions = useMemo(
    () => (positionsQuery.data ?? []).filter((position) => position.status === 'closed'),
    [positionsQuery.data]
  );

  return {
    positions,
    isLoading: positionsQuery.isLoading,
    isError: positionsQuery.isError,
    error: positionsQuery.error instanceof Error ? positionsQuery.error.message : undefined,
  };
}
