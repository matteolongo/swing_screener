import { useMemo } from 'react';
import Card from '@/components/common/Card';
import { getGlossaryEntry, type EducationMetricKey } from '@/content/educationGlossary';
import { t } from '@/i18n/t';

const GLOSSARY_KEYS: EducationMetricKey[] = [
  'RR',
  'RS',
  'ATR',
  'SCORE',
  'CONFIDENCE',
  'MOM_6M',
  'MOM_12M',
  'RISK_PCT',
  'FEE_TO_RISK',
  'R_NOW',
];

export default function GlossaryGrid() {
  const entries = useMemo(() => GLOSSARY_KEYS.map(getGlossaryEntry), []);

  return (
    <section id="glossary" className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">{t('learn.glossary.title')}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('learn.glossary.subtitle')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {entries.map((entry) => (
          <Card key={entry.key} variant="bordered" className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{entry.label}</p>
              <h3 className="mt-1 text-lg font-semibold">{entry.title}</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">{entry.tooltip}</p>
            <p className="text-sm text-slate-700 dark:text-slate-300">{entry.explanation}</p>
            {entry.formula ? (
              <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {entry.formula}
              </div>
            ) : null}
            <p className="text-sm text-slate-700 dark:text-slate-300">{entry.interpretation}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
