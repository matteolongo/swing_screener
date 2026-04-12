import Card from '@/components/common/Card';
import { t } from '@/i18n/t';

const conceptKeys = [
  'riskReward',
  'stopLoss',
  'positionSizing',
  'tradeThesis',
  'invalidation',
] as const;

export default function CoreConceptsSection() {
  return (
    <section id="concepts" className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">{t('learn.nav.concepts')}</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {conceptKeys.map((conceptKey) => (
          <Card key={conceptKey} variant="bordered" className="space-y-3">
            <h3 className="text-lg font-semibold">{t(`learn.concepts.${conceptKey}.title`)}</h3>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
              {t(`learn.concepts.${conceptKey}.body`)}
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}
