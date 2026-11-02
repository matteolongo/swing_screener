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

export function useTodayActions(flatItems: FlatItem[], onTickerSelect: (ticker: string) => void, positions: Position[] = [], positionsUnavailable = false) {
  const [doneIds, setDoneIds] = useState<Set<string>>(() => new Set());
  const [acceptedStops, setAcceptedStops] = useState<Set<string>>(new Set());
  const [updateStopTargetId, setUpdateStopTargetId] = useState<string | null>(null);
  const [closeTargetId, setCloseTargetId] = useState<string | null>(null);
  const [trimTargetId, setTrimTargetId] = useState<string | null>(null);
  const currentPosition = (id: string | null) => positions.find(position => position.positionId === id && position.status === 'open') ?? null;
  const updateStopTarget = currentPosition(updateStopTargetId);
  const closeTarget = currentPosition(closeTargetId);
  const trimTarget = currentPosition(trimTargetId);
  const setUpdateStopTarget = (position: Position | null) => setUpdateStopTargetId(position?.positionId ?? null);
  const setCloseTarget = (position: Position | null) => setCloseTargetId(position?.positionId ?? null);
  const setTrimTarget = (position: Position | null) => setTrimTargetId(position?.positionId ?? null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const focusedIdRef = useRef(focusedId);

  const acceptStopMutation = useUpdateStopMutation();
  const updateStopMutation = useUpdateStopMutation();
  const closePositionMutation = useClosePositionMutation();
  const partialCloseMutation = usePartialClosePositionMutation();

  const handleAcceptStop = useCallback(
    (positionId: string, stopSuggested: number, reason: string) => {
      const position = positions.find(item => item.positionId === positionId && item.status === 'open');
      if (!position || positionsUnavailable) return;
      acceptStopMutation.mutate(
        { positionId, request: { newStop: stopSuggested, reason, expectedVersion: position.version ?? 1 } },
        { onSuccess: () => setAcceptedStops((prev) => new Set([...prev, positionId])) },
      );
    },
    [acceptStopMutation, positions, positionsUnavailable],
  );

  const handleUpdateStop = useCallback(
    (position: Position, req: UpdateStopRequest) => {
      updateStopMutation.mutate(
        { positionId: position.positionId!, request: req },
        {
          onSuccess: () => {
            setUpdateStopTargetId(null);
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
            setCloseTargetId(null);
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
        { onSuccess: () => setTrimTargetId(null) },
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
