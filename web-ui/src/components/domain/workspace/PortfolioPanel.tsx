import Card from '@/components/common/Card';
import PortfolioTable from '@/components/domain/workspace/PortfolioTable';
import { t } from '@/i18n/t';

export default function PortfolioPanel() {
  return (
    <Card variant="bordered" className="h-full p-4 md:p-5 space-y-3 overflow-hidden">
      <div>
        <h2 className="text-lg font-semibold">{t('workspacePage.panels.portfolio.title')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {t('workspacePage.panels.portfolio.description')}
        </p>
      </div>
      <PortfolioTable />
    </Card>
  );
}
