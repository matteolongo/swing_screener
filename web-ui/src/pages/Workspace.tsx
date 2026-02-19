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
  const showNextActionCard = onboardingStatus !== 'completed';

  useEffect(() => {
    setShowOnboarding(onboardingStatus === 'new');
  }, [onboardingStatus]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <OnboardingModal isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />

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
        <div className="min-h-[520px] xl:col-span-7 xl:max-h-[calc(100vh-190px)]">
          <ScreenerInboxPanel />
        </div>
        <div className="min-h-[520px] xl:col-span-5 xl:max-h-[calc(100vh-190px)]">
          <AnalysisCanvasPanel />
        </div>
        <div className="xl:col-span-12 min-h-[340px]">
          <PortfolioPanel />
        </div>
      </div>
    </div>
  );
}
