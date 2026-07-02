import { useCallback, useEffect, useState } from 'react';
import {
  useUpdateStopMutation,
  useClosePositionMutation,
} from '@/features/portfolio/hooks';
import type { ClosePositionRequest, Position, UpdateStopRequest } from '@/features/portfolio/types';
import type { InboxItem } from '@/features/dailyReview/inbox';

export function useTodayActions(items: InboxItem[], onTickerSelect: (ticker: string) => void) {
  const [doneIds, setDoneIds] = useState<Set<string>>(() => new Set());
  const [acceptedStops, setAcceptedStops] = useState<Set<string>>(new Set());
  const [updateStopTarget, setUpdateStopTarget] = useState<Position | null>(null);
  const [closeTarget, setCloseTarget] = useState<Position | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const acceptStopMutation = useUpdateStopMutation();
  const updateStopMutation = useUpdateStopMutation();
  const closePositionMutation = useClosePositionMutation();

  const handleAcceptStop = useCallback(
    (itemId: string, positionId: string, stopSuggested: number, reason: string) => {
      acceptStopMutation.mutate(
        { positionId, request: { newStop: stopSuggested, reason } },
        { onSuccess: () => setAcceptedStops((prev) => new Set([...prev, itemId])) },
      );
    },
    [acceptStopMutation],
  );

  const handleUpdateStop = useCallback(
    (position: Position, req: UpdateStopRequest) => {
      updateStopMutation.mutate(
        { positionId: position.positionId!, request: req },
        {
          onSuccess: () => {
            setUpdateStopTarget(null);
            setDoneIds((prev) => new Set([...prev, position.positionId!]));
          },
        },
      );
    },
    [updateStopMutation],
  );

  const handleClosePosition = useCallback(
    (position: Position, req: ClosePositionRequest) => {
      closePositionMutation.mutate(
        { positionId: position.positionId!, request: req },
        {
          onSuccess: () => {
            setCloseTarget(null);
            setDoneIds((prev) => new Set([...prev, position.positionId!]));
          },
        },
      );
    },
    [closePositionMutation],
  );

  const handleItemClick = useCallback(
    (ticker: string) => {
      setFocusedIndex((prev) => {
        const idx = items.findIndex((it) => it.ticker === ticker);
        return idx !== -1 ? idx : prev;
      });
      onTickerSelect(ticker);
    },
    [items, onTickerSelect],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((i) => {
          const next = Math.min(i + 1, items.length - 1);
          const nextItem = items[next];
          if (nextItem?.ticker) onTickerSelect(nextItem.ticker);
          return next;
        });
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((i) => {
          const prev = Math.max(i - 1, 0);
          const prevItem = items[prev];
          if (prevItem?.ticker) onTickerSelect(prevItem.ticker);
          return prev;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [items, onTickerSelect]);

  return {
    doneIds,
    acceptedStops,
    acceptStopMutation,
    updateStopMutation,
    closePositionMutation,
    updateStopTarget,
    setUpdateStopTarget,
    closeTarget,
    setCloseTarget,
    focusedIndex,
    handleAcceptStop,
    handleUpdateStop,
    handleClosePosition,
    handleItemClick,
  };
}
