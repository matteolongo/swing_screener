import StrategyPage from '@/pages/Strategy';
import { t } from '@/i18n/t';

interface MethodSettingsPanelProps {
  defaultOpen?: boolean;
}

export default function MethodSettingsPanel({ defaultOpen = false }: MethodSettingsPanelProps) {
  return (
    <section id="settings" className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">{t('learn.methodSettings.title')}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('learn.methodSettings.subtitle')}</p>
      </div>
      <details open={defaultOpen} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">
          {t('sidebar.nav.methodSettings')}
        </summary>
        <div className="mt-5">
          <StrategyPage embedded />
        </div>
      </details>
    </section>
  );
}
