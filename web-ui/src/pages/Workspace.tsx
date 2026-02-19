import { useEffect, useState } from 'react';
import AnalysisCanvasPanel from '@/components/domain/workspace/AnalysisCanvasPanel';
import PortfolioPanel from '@/components/domain/workspace/PortfolioPanel';
import ScreenerInboxPanel from '@/components/domain/workspace/ScreenerInboxPanel';
import TodaysNextActionCard from '@/components/domain/onboarding/TodaysNextActionCard';
import OnboardingModal from '@/components/modals/OnboardingModal';
import { t } from '@/i18n/t';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export default function Workspace() {
  const { status: onboardingStatus } = useOnboardingStore();
  const requestRunScreener = useWorkspaceStore((state) => state.requestRunScreener);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    setShowOnboarding(onboardingStatus === 'new');
  }, [onboardingStatus]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <OnboardingModal isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />

      <div>
        <h1 className="text-3xl font-bold">{t('workspacePage.title')}</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">{t('workspacePage.subtitle')}</p>
      </div>

      <TodaysNextActionCard onRunScreener={requestRunScreener} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-stretch">
        <div className="min-h-[520px] xl:max-h-[calc(100vh-220px)]">
          <ScreenerInboxPanel />
        </div>
        <div className="min-h-[520px] xl:max-h-[calc(100vh-220px)]">
          <AnalysisCanvasPanel />
        </div>
        <div className="xl:col-span-2 min-h-[360px]">
          <PortfolioPanel />
        </div>
      </div>
    </div>
  );
}
