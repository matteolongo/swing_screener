import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
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
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const focusedIdRef = useRef(focusedId);

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
    (ticker: string, id: string) => {
      focusedIdRef.current = id;
      setFocusedId(id);
      onTickerSelect(ticker);
    },
    [onTickerSelect],
  );

  useEffect(() => {
    focusedIdRef.current = focusedId;
  }, [focusedId]);

  useEffect(() => {
    if (focusedId && !flatItems.some((item) => item.id === focusedId)) {
      focusedIdRef.current = null;
      setFocusedId(null);
    }
  }, [flatItems, focusedId]);

  const handleListKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"], [role="dialog"]')) return;
      const currentIndex = flatItems.findIndex((item) => item.id === focusedIdRef.current);
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(currentIndex + 1, flatItems.length - 1);
        const item = flatItems[next];
        if (item) {
          focusedIdRef.current = item.id;
          setFocusedId(item.id);
          onTickerSelect(item.ticker);
        }
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = Math.max(currentIndex === -1 ? 0 : currentIndex - 1, 0);
        const item = flatItems[prev];
        if (item) {
          focusedIdRef.current = item.id;
          setFocusedId(item.id);
          onTickerSelect(item.ticker);
        }
      }
    },
    [flatItems, onTickerSelect],
  );

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
    focusedId,
    handleListKeyDown,
    handleAcceptStop,
    handleUpdateStop,
    handleClosePosition,
    handlePartialClose,
    handleItemClick,
  };
}
