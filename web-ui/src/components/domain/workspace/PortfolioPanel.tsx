import Card from '@/components/common/Card';
import PortfolioTable from '@/components/domain/workspace/PortfolioTable';
import { t } from '@/i18n/t';

export default function PortfolioPanel() {
  return (
    <Card variant="bordered" className="p-4 md:p-5 space-y-3 xl:h-full xl:overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('workspacePage.panels.portfolio.title')}</h2>
          <p className="text-sm text-muted mt-1">
            {t('workspacePage.panels.portfolio.description')}
          </p>
        </div>
      </div>

      <PortfolioTable />
    </Card>
  );
}
