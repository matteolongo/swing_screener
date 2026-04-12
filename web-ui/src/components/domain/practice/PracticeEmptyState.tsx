import { Link } from 'react-router-dom';
import Card from '@/components/common/Card';
import { t } from '@/i18n/t';

export default function PracticeEmptyState() {
  return (
    <Card variant="bordered" className="mx-auto max-w-2xl text-center">
      <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {t('practice.empty.headline')}
      </h2>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
        {t('practice.empty.body')}
      </p>
      <Link
        to="/review"
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        {t('sidebar.nav.review')}
      </Link>
    </Card>
  );
}
