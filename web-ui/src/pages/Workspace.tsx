import { useCallback, useEffect, useState } from 'react';
import AnalysisCanvasPanel from '@/components/domain/workspace/AnalysisCanvasPanel';
import PortfolioPanel from '@/components/domain/workspace/PortfolioPanel';
import ScreenerInboxPanel from '@/components/domain/workspace/ScreenerInboxPanel';
import WorkspaceSymbolModal from '@/components/domain/workspace/WorkspaceSymbolModal';
import TodaysNextActionCard from '@/components/domain/onboarding/TodaysNextActionCard';
import OnboardingModal from '@/components/modals/OnboardingModal';
import { t } from '@/i18n/t';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { WorkspaceAnalysisTab } from '@/stores/workspaceStore';

export default function Workspace() {
  const { status: onboardingStatus } = useOnboardingStore();
  const requestRunScreener = useWorkspaceStore((state) => state.requestRunScreener);
  const setSelectedTicker = useWorkspaceStore((state) => state.setSelectedTicker);
  const setAnalysisTab = useWorkspaceStore((state) => state.setAnalysisTab);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [detailTicker, setDetailTicker] = useState<string | null>(null);
  const showNextActionCard = onboardingStatus !== 'completed';

  useEffect(() => {
    setShowOnboarding(onboardingStatus === 'new');
  }, [onboardingStatus]);

  const openSymbolDetails = useCallback(
    (ticker: string, tab: WorkspaceAnalysisTab) => {
      const normalizedTicker = ticker.trim().toUpperCase();
      setSelectedTicker(normalizedTicker);
      setAnalysisTab(tab);
      setDetailTicker(normalizedTicker);
    },
    [setAnalysisTab, setSelectedTicker]
  );

  const closeSymbolDetails = useCallback(() => setDetailTicker(null), []);

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <OnboardingModal isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />
      {detailTicker ? <WorkspaceSymbolModal ticker={detailTicker} onBack={closeSymbolDetails} /> : null}

      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold">{t('workspacePage.title')}</h1>
        <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">{t('workspacePage.subtitle')}</p>
      </div>

      {showNextActionCard ? (
        <div className="xl:max-w-3xl">
          <TodaysNextActionCard onRunScreener={requestRunScreener} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
        <div className="xl:min-h-[520px] xl:col-span-7 xl:max-h-[calc(100vh-190px)]">
          <ScreenerInboxPanel onOpenSymbolDetails={openSymbolDetails} />
        </div>
        <div className="xl:min-h-[520px] xl:col-span-5 xl:max-h-[calc(100vh-190px)]">
          <AnalysisCanvasPanel />
        </div>
        <div className="xl:col-span-12 xl:min-h-[340px]">
          <PortfolioPanel />
        </div>
      </div>
    </div>
  );
}
