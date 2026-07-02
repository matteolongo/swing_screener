import { useCallback, useEffect, useState } from 'react';
import {
  useUpdateStopMutation,
  useClosePositionMutation,
} from '@/features/portfolio/hooks';
import type { ClosePositionRequest, Position, UpdateStopRequest } from '@/features/portfolio/types';
import type { InboxItem } from '@/features/dailyReview/inbox';

/** A modal target paired with the inbox item id that opened it, so success handlers
 * can mark the right row done — `doneIds`/rows are keyed by `item.id` (e.g. `close:AMAT`),
 * never by `position.positionId`. */
export interface InboxModalTarget {
  position: Position;
  itemId: string;
}

export function useTodayActions(items: InboxItem[], onTickerSelect: (ticker: string) => void) {
  const [doneIds, setDoneIds] = useState<Set<string>>(() => new Set());
  const [acceptedStops, setAcceptedStops] = useState<Set<string>>(new Set());
  const [updateStopTarget, setUpdateStopTarget] = useState<InboxModalTarget | null>(null);
  const [closeTarget, setCloseTarget] = useState<InboxModalTarget | null>(null);
  const [acceptingItemId, setAcceptingItemId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const acceptStopMutation = useUpdateStopMutation();
  const updateStopMutation = useUpdateStopMutation();
  const closePositionMutation = useClosePositionMutation();

  const markDone = useCallback((itemId: string) => {
    setDoneIds((prev) => new Set([...prev, itemId]));
  }, []);

  const handleAcceptStop = useCallback(
    (itemId: string, positionId: string, stopSuggested: number, reason: string) => {
      setAcceptingItemId(itemId);
      acceptStopMutation.mutate(
        { positionId, request: { newStop: stopSuggested, reason } },
        {
          onSuccess: () => setAcceptedStops((prev) => new Set([...prev, itemId])),
          onSettled: () => setAcceptingItemId((cur) => (cur === itemId ? null : cur)),
        },
      );
    },
    [acceptStopMutation],
  );

  const handleUpdateStop = useCallback(
    (target: InboxModalTarget, req: UpdateStopRequest) => {
      updateStopMutation.mutate(
        { positionId: target.position.positionId!, request: req },
        {
          onSuccess: () => {
            setUpdateStopTarget(null);
            markDone(target.itemId);
          },
        },
      );
    },
    [updateStopMutation, markDone],
  );

  const handleClosePosition = useCallback(
    (target: InboxModalTarget, req: ClosePositionRequest) => {
      closePositionMutation.mutate(
        { positionId: target.position.positionId!, request: req },
        {
          onSuccess: () => {
            setCloseTarget(null);
            markDone(target.itemId);
          },
        },
      );
    },
    [closePositionMutation, markDone],
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
    markDone,
    acceptedStops,
    acceptingItemId,
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
