import ScreenerInboxPanel from '@/components/domain/workspace/ScreenerInboxPanel';
import { t } from '@/i18n/t';

export default function PowerToolsPanel() {
  return (
    <section id="power-tools" className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">{t('learn.powerTools.title')}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('learn.powerTools.subtitle')}</p>
      </div>
      <details className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/60">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">
          Advanced: Raw Screener
        </summary>
        <div className="mt-5">
          <ScreenerInboxPanel />
        </div>
      </details>
    </section>
  );
}
