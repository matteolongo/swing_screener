import Card from '@/components/common/Card';
import AnalysisCanvasPanel from '@/components/domain/workspace/AnalysisCanvasPanel';
import ScreenerInboxPanel from '@/components/domain/workspace/ScreenerInboxPanel';
import { t } from '@/i18n/t';

function PanelPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <Card variant="bordered" className="h-full">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
      </div>
    </Card>
  );
}

export default function Workspace() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('workspacePage.title')}</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">{t('workspacePage.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="min-h-[420px]">
          <ScreenerInboxPanel />
        </div>
        <div className="min-h-[420px]">
          <AnalysisCanvasPanel />
        </div>
        <div className="lg:col-span-2 min-h-[360px]">
          <PanelPlaceholder
            title={t('workspacePage.panels.portfolio.title')}
            description={t('workspacePage.panels.portfolio.placeholder')}
          />
        </div>
      </div>
    </div>
  );
}
