import { useNavigate } from 'react-router-dom';
import AnalysisCanvasPanel from '@/components/domain/workspace/AnalysisCanvasPanel';
import FloatingChatWidget from '@/components/domain/workspace/FloatingChatWidget';
import PortfolioPanel from '@/components/domain/workspace/PortfolioPanel';
import ScreenerInboxPanel from '@/components/domain/workspace/ScreenerInboxPanel';
import TodaysNextActionCard from '@/components/domain/onboarding/TodaysNextActionCard';
import Button from '@/components/common/Button';
import { useSymbolIntelligenceRunner } from '@/features/intelligence/useSymbolIntelligenceRunner';
import { t } from '@/i18n/t';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export default function Workspace() {
  const navigate = useNavigate();
  const { status: onboardingStatus } = useOnboardingStore();
  const requestRunScreener = useWorkspaceStore((state) => state.requestRunScreener);
  const selectedTicker = useWorkspaceStore((state) => state.selectedTicker);
  const showNextActionCard = onboardingStatus !== 'completed';
  const { runForTicker, getStatusForTicker } = useSymbolIntelligenceRunner();
  const selectedTickerIntelligenceStatus = selectedTicker ? getStatusForTicker(selectedTicker) : undefined;

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold">{t('workspacePage.title')}</h1>
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">{t('workspacePage.subtitle')}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/onboarding')}>
          {t('workspacePage.openOnboarding')}
        </Button>
      </div>

      {showNextActionCard ? (
        <div className="xl:max-w-3xl">
          <TodaysNextActionCard onRunScreener={requestRunScreener} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <div className="xl:col-span-7 xl:h-[calc(100vh-190px)] xl:min-h-[520px] xl:overflow-hidden">
          <ScreenerInboxPanel
            onRunSymbolIntelligence={runForTicker}
            getSymbolIntelligenceStatus={getStatusForTicker}
          />
        </div>
        <div className="xl:col-span-5 xl:h-[calc(100vh-190px)] xl:min-h-[520px] xl:overflow-hidden">
          <AnalysisCanvasPanel
            onRunSymbolIntelligence={runForTicker}
            symbolIntelligenceStatus={selectedTickerIntelligenceStatus}
          />
        </div>
        <div className="xl:col-span-12 xl:min-h-[340px]">
          <PortfolioPanel />
        </div>
      </div>

      <FloatingChatWidget />
    </div>
  );
}
