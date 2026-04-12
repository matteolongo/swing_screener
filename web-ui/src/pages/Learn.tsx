import { useLocation } from 'react-router-dom';
import CoreConceptsSection from '@/components/domain/learn/CoreConceptsSection';
import GlossaryGrid from '@/components/domain/learn/GlossaryGrid';
import MethodSettingsPanel from '@/components/domain/learn/MethodSettingsPanel';
import PowerToolsPanel from '@/components/domain/learn/PowerToolsPanel';
import { t } from '@/i18n/t';

const anchors = [
  { id: 'concepts', labelKey: 'learn.nav.concepts' },
  { id: 'glossary', labelKey: 'learn.nav.glossary' },
  { id: 'settings', labelKey: 'learn.nav.settings' },
  { id: 'power-tools', labelKey: 'learn.nav.powerTools' },
] as const;

export default function Learn() {
  const location = useLocation();
  const settingsOpen = location.pathname === '/learn/settings';

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">{t('sidebar.nav.learn')}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Learn the method before you act on live setups.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2">
        {anchors.map((anchor) => (
          <a
            key={anchor.id}
            href={`#${anchor.id}`}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {t(anchor.labelKey)}
          </a>
        ))}
      </nav>

      <CoreConceptsSection />
      <GlossaryGrid />
      <MethodSettingsPanel defaultOpen={settingsOpen} />
      <PowerToolsPanel />
    </div>
  );
}
