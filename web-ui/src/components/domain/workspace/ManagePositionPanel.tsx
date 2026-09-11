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
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { t } from '@/i18n/t';
import { formatCurrency } from '@/utils/formatters';
import { getCanonicalOrderDraft } from '@/features/screener/types';

interface ManagePositionPanelProps {
  position: PositionWithMetrics;
  candidate?: SymbolAnalysisCandidate | null;
}

type ModalKind = 'stop' | 'scaleOut' | 'exit' | null;

export default function ManagePositionPanel({ position, candidate }: ManagePositionPanelProps) {
  const [modal, setModal] = useState<ModalKind>(null);
  const [checkLive, setCheckLive] = useState(false);

  const updateStopMutation = useUpdateStopMutation(() => setModal(null));
  const partialCloseMutation = usePartialClosePositionMutation(() => setModal(null));
  const closePositionMutation = useClosePositionMutation(() => setModal(null));
  const positionId = position.positionId ?? '';
  const stopPreview = usePositionStopPreviewQuery(positionId, null, checkLive);

  const setActiveTab = useWorkspaceStore((state) => state.setAnalysisTab);
  const canAdd = Boolean(
    (candidate?.sameSymbol?.mode === 'ADD_ON' || candidate?.sameSymbol?.mode === 'SCALE_BACK')
      && getCanonicalOrderDraft(candidate),
  );

  const displayedR = checkLive && stopPreview.data ? stopPreview.data.rNow : position.rNow;
  const rSign = displayedR >= 0 ? '+' : '';

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
          <Badge variant={displayedR >= 0 ? 'success' : 'error'}>
            {t('workspacePage.panels.analysis.managePosition.currentR')}: {rSign}{displayedR.toFixed(2)}R
          </Badge>
          <Badge variant="default">
            {t('workspacePage.panels.analysis.managePosition.daysHeld')}: {position.daysOpen}
          </Badge>
        </div>
      </div>

      <section className="rounded-md border border-border bg-foreground/5 p-3 space-y-2">
        <div>
          <h4 className="text-sm font-medium text-foreground">
            {t('workspacePage.panels.analysis.managePosition.previewTitle')}
          </h4>
          <p className="text-xs text-muted">
            {t('workspacePage.panels.analysis.managePosition.previewDescription')}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setCheckLive(true)}>
          {t('workspacePage.panels.analysis.managePosition.checkLive')}
        </Button>
      </section>

      {checkLive && stopPreview.data && (
        <div className="rounded-md border border-border bg-foreground/5 px-3 py-2 text-sm text-muted space-y-1">
          <div>
            <span className="font-medium text-foreground">{stopPreview.data.action}</span>
            {' · '}{stopPreview.data.reason}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <span>
              {t('workspacePage.panels.analysis.managePosition.liveR')}: {rSign}{stopPreview.data.rNow.toFixed(2)}R
            </span>
            <span>
              {t('workspacePage.panels.analysis.managePosition.currentStop')}: {formatCurrency(stopPreview.data.stopOld)}
            </span>
            <span>
              {t('workspacePage.panels.analysis.managePosition.suggestedStop')}: {formatCurrency(stopPreview.data.stopSuggested)}
            </span>
          </div>
        </div>
      )}

      <section className="border-t border-border pt-3 space-y-2">
        <div>
          <h4 className="text-sm font-medium text-foreground">
            {t('workspacePage.panels.analysis.managePosition.changesTitle')}
          </h4>
          <p className="text-xs text-muted">
            {t('workspacePage.panels.analysis.managePosition.changesDescription')}
          </p>
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
          {canAdd && (
            <Button size="sm" variant="secondary" onClick={() => setActiveTab('order')}>
              {t('workspacePage.panels.analysis.managePosition.add')}
            </Button>
          )}
        </div>
      </section>

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
