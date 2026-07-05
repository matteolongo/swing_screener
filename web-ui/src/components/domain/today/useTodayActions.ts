import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useUpdateStopMutation,
  useClosePositionMutation,
  usePartialClosePositionMutation,
} from '@/features/portfolio/hooks';
import type { ClosePositionRequest, PartialCloseRequest, Position, UpdateStopRequest } from '@/features/portfolio/types';

interface FlatItem {
  ticker: string;
  id: string;
}

export function useTodayActions(flatItems: FlatItem[], onTickerSelect: (ticker: string) => void) {
  const [doneIds, setDoneIds] = useState<Set<string>>(() => new Set());
  const [acceptedStops, setAcceptedStops] = useState<Set<string>>(new Set());
  const [updateStopTarget, setUpdateStopTarget] = useState<Position | null>(null);
  const [closeTarget, setCloseTarget] = useState<Position | null>(null);
  const [trimTarget, setTrimTarget] = useState<Position | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const focusedIndexRef = useRef(focusedIndex);

  const acceptStopMutation = useUpdateStopMutation();
  const updateStopMutation = useUpdateStopMutation();
  const closePositionMutation = useClosePositionMutation();
  const partialCloseMutation = usePartialClosePositionMutation();

  const handleAcceptStop = useCallback(
    (positionId: string, stopSuggested: number, reason: string) => {
      acceptStopMutation.mutate(
        { positionId, request: { newStop: stopSuggested, reason } },
        { onSuccess: () => setAcceptedStops((prev) => new Set([...prev, positionId])) },
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

  const handlePartialClose = useCallback(
    (position: Position, req: PartialCloseRequest) => {
      partialCloseMutation.mutate(
        { positionId: position.positionId!, request: req },
        { onSuccess: () => setTrimTarget(null) },
      );
    },
    [partialCloseMutation],
  );

  const handleItemClick = useCallback(
    (ticker: string) => {
      const idx = flatItems.findIndex((fi) => fi.ticker === ticker);
      if (idx !== -1) {
        focusedIndexRef.current = idx;
        setFocusedIndex(idx);
      }
      onTickerSelect(ticker);
    },
    [flatItems, onTickerSelect],
  );

  useEffect(() => {
    focusedIndexRef.current = focusedIndex;
  }, [focusedIndex]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(focusedIndexRef.current + 1, flatItems.length - 1);
        focusedIndexRef.current = next;
        setFocusedIndex(next);
        if (flatItems[next]) onTickerSelect(flatItems[next].ticker);
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = Math.max(focusedIndexRef.current - 1, 0);
        focusedIndexRef.current = prev;
        setFocusedIndex(prev);
        if (flatItems[prev]) onTickerSelect(flatItems[prev].ticker);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flatItems, onTickerSelect]);

  return {
    doneIds,
    acceptedStops,
    acceptStopMutation,
    updateStopMutation,
    closePositionMutation,
    partialCloseMutation,
    updateStopTarget,
    setUpdateStopTarget,
    closeTarget,
    setCloseTarget,
    trimTarget,
    setTrimTarget,
    focusedIndex,
    handleAcceptStop,
    handleUpdateStop,
    handleClosePosition,
    handlePartialClose,
    handleItemClick,
  };
}
