import { useState } from 'react';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import ClosePositionModalForm from '@/components/domain/positions/ClosePositionModalForm';
import PartialCloseModalForm from '@/components/domain/positions/PartialCloseModalForm';
import UpdateStopModalForm from '@/components/domain/positions/UpdateStopModalForm';
import type { PositionWithMetrics } from '@/features/portfolio/api';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import {
  useClosePositionMutation,
  usePartialClosePositionMutation,
  usePositionStopPreviewQuery,
  useUpdateStopMutation,
} from '@/features/portfolio/hooks';
import { t } from '@/i18n/t';

interface ManagePositionPanelProps {
  position: PositionWithMetrics;
  candidate?: SymbolAnalysisCandidate | null;
  onPrepareOrder?: () => void;
}

const ENTRY_ACTIONS = new Set(['BUY_NOW', 'BUY_ON_PULLBACK', 'WAIT_FOR_BREAKOUT']);

type ModalKind = 'stop' | 'scaleOut' | 'exit' | null;

export default function ManagePositionPanel({ position, candidate, onPrepareOrder }: ManagePositionPanelProps) {
  const [modal, setModal] = useState<ModalKind>(null);
  const [checkLive, setCheckLive] = useState(false);

  const updateStopMutation = useUpdateStopMutation(() => setModal(null));
  const partialCloseMutation = usePartialClosePositionMutation(() => setModal(null));
  const closePositionMutation = useClosePositionMutation(() => setModal(null));
  const positionId = position.positionId ?? '';
  const stopPreview = usePositionStopPreviewQuery(positionId, null, checkLive);

  const canAdd = ENTRY_ACTIONS.has(candidate?.decisionSummary?.action ?? '');

  const rSign = position.rNow >= 0 ? '+' : '';

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {t('workspacePage.panels.analysis.managePosition.title')}
          </h3>
          <p className="text-xs text-muted">
            {t('workspacePage.panels.analysis.managePosition.description', { ticker: position.ticker })}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant={position.rNow >= 0 ? 'success' : 'error'}>
            {t('workspacePage.panels.analysis.managePosition.currentR')}: {rSign}{position.rNow.toFixed(2)}R
          </Badge>
          <Badge variant="default">
            {t('workspacePage.panels.analysis.managePosition.daysHeld')}: {position.daysOpen}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={() => setModal('stop')}>
          {t('workspacePage.panels.analysis.managePosition.updateStop')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setModal('scaleOut')}>
          {t('workspacePage.panels.analysis.managePosition.scaleOut')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setModal('exit')}>
          {t('workspacePage.panels.analysis.managePosition.exit')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setCheckLive(true)}>
          {t('workspacePage.panels.analysis.managePosition.checkLive')}
        </Button>
        {canAdd && (
          <Button size="sm" variant="secondary" onClick={() => onPrepareOrder?.()}>
            {t('workspacePage.panels.analysis.managePosition.add')}
          </Button>
        )}
      </div>

      {checkLive && stopPreview.data && (
        <div className="rounded-md border border-border bg-foreground/5 px-3 py-2 text-sm text-muted">
          <span className="font-medium text-foreground">{stopPreview.data.action}</span>
          {' · '}{stopPreview.data.reason}
        </div>
      )}

      {modal === 'stop' && (
        <UpdateStopModalForm
          position={position}
          isLoading={updateStopMutation.isPending}
          error={updateStopMutation.error instanceof Error ? updateStopMutation.error.message : undefined}
          onClose={() => setModal(null)}
          onSubmit={(request) => updateStopMutation.mutate({ positionId, request })}
        />
      )}
      {modal === 'scaleOut' && (
        <PartialCloseModalForm
          position={position}
          isLoading={partialCloseMutation.isPending}
          error={partialCloseMutation.error instanceof Error ? partialCloseMutation.error.message : undefined}
          onClose={() => setModal(null)}
          onSubmit={(request) => partialCloseMutation.mutate({ positionId, request })}
        />
      )}
      {modal === 'exit' && (
        <ClosePositionModalForm
          position={position}
          isLoading={closePositionMutation.isPending}
          error={closePositionMutation.error instanceof Error ? closePositionMutation.error.message : undefined}
          onClose={() => setModal(null)}
          onSubmit={(request) => closePositionMutation.mutate({ positionId, request })}
        />
      )}
    </div>
  );
}
