import { useCallback, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  useUpdateStopMutation,
  useClosePositionMutation,
  usePartialClosePositionMutation,
} from '@/features/portfolio/hooks';
import type { ClosePositionRequest, PartialCloseRequest, Position, UpdateStopRequest } from '@/features/portfolio/types';

export function useTodayActions(onTickerSelect: (ticker: string, rowId: string, focusInspector?: boolean) => void, positions: Position[] = [], positionsUnavailable = false) {
  const [doneIds, setDoneIds] = useState<Set<string>>(() => new Set());
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

  const acceptStopMutation = useUpdateStopMutation();
  const updateStopMutation = useUpdateStopMutation();
  const closePositionMutation = useClosePositionMutation();
  const partialCloseMutation = usePartialClosePositionMutation();

  const handleAcceptStop = useCallback(
    (positionId: string, stopSuggested: number, reason: string) => {
      const position = positions.find(item => item.positionId === positionId && item.status === 'open');
      if (!position || positionsUnavailable || acceptStopMutation.isPending || position.stopPrice >= stopSuggested) return;
      acceptStopMutation.mutate(
        { positionId, request: { newStop: stopSuggested, reason, expectedVersion: position.version ?? 1 } },
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

  const handleListKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const forward = event.key === 'j' || event.key === 'ArrowDown';
      if (!forward && event.key !== 'k' && event.key !== 'ArrowUp') return;

      const selector = 'button[data-review-row-id]';
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>(selector);
      if (!button) return;
      const rows = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>(selector));
      const currentIndex = rows.indexOf(button);
      if (currentIndex < 0) return;
      event.preventDefault();

      const next = rows[currentIndex + (forward ? 1 : -1)];
      if (!next?.dataset.reviewTicker || !next.dataset.reviewRowId) return;
      next.focus();
      onTickerSelect(next.dataset.reviewTicker, next.dataset.reviewRowId, false);
    },
    [onTickerSelect],
  );

  return {
    doneIds,
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
    handleListKeyDown,
    handleAcceptStop,
    handleUpdateStop,
    handleClosePosition,
    handlePartialClose,
  };
}
