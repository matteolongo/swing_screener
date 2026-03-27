import type { ReactNode } from 'react';
import ModalShell from '@/components/common/ModalShell';
import SymbolAnalysisContent from '@/components/domain/workspace/SymbolAnalysisContent';
import type {
  SymbolAnalysisCandidate,
  WorkspaceAnalysisTab,
} from '@/components/domain/workspace/types';
import type { SymbolIntelligenceStatus } from '@/features/intelligence/useSymbolIntelligenceRunner';
import { t } from '@/i18n/t';

interface SymbolAnalysisModalProps {
  ticker: string;
  candidate?: SymbolAnalysisCandidate | null;
  activeTab: WorkspaceAnalysisTab;
  onTabChange: (tab: WorkspaceAnalysisTab) => void;
  onClose: () => void;
  orderPanel?: ReactNode;
  onRunSymbolIntelligence?: (ticker: string) => void;
  symbolIntelligenceStatus?: SymbolIntelligenceStatus;
}

export default function SymbolAnalysisModal({
  ticker,
  candidate,
  activeTab,
  onTabChange,
  onClose,
  orderPanel,
  onRunSymbolIntelligence,
  symbolIntelligenceStatus,
}: SymbolAnalysisModalProps) {
  return (
    <ModalShell
      title={t('workspacePage.symbolDetails.title', { ticker })}
      onClose={onClose}
      className="max-w-6xl"
      closeAriaLabel={t('order.candidateModal.closeAria')}
    >
      <div className="flex min-h-[32rem] flex-col gap-3">
        <SymbolAnalysisContent
          ticker={ticker}
          candidate={candidate}
          activeTab={activeTab}
          onTabChange={onTabChange}
          orderPanel={orderPanel}
          onRunSymbolIntelligence={onRunSymbolIntelligence}
          symbolIntelligenceStatus={symbolIntelligenceStatus}
        />
      </div>
    </ModalShell>
  );
}
