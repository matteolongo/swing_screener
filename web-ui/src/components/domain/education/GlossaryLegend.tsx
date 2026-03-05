import { EducationMetricKey, getGlossaryEntry } from '@/content/educationGlossary';
import { t } from '@/i18n/t';
import { Link } from 'react-router-dom';

interface GlossaryLegendProps {
  metricKeys: EducationMetricKey[];
  title?: string;
  showLearnLink?: boolean;
}

export default function GlossaryLegend({
  metricKeys,
  title,
  showLearnLink = false,
}: GlossaryLegendProps) {
  const resolvedTitle = title ?? t('educationGlossary.title');
  const firstEntry = metricKeys[0] ? getGlossaryEntry(metricKeys[0]) : null;
  const learnHref = firstEntry ? `/learn?q=${encodeURIComponent(firstEntry.label)}` : '/learn';

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-blue-900">{resolvedTitle}</h3>
        {showLearnLink ? (
          <Link
            to={learnHref}
            className="text-xs text-blue-700 hover:underline"
            title={t('learnPage.openTitle')}
            aria-label={t('learnPage.openAria')}
          >
            {t('learnPage.openAction')}
          </Link>
        ) : null}
      </div>
      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-xs text-blue-900">
        {metricKeys.map((metricKey) => {
          const entry = getGlossaryEntry(metricKey);
          return (
            <div key={metricKey}>
              <span className="font-semibold">{entry.label}:</span> {entry.tooltip}
            </div>
          );
        })}
      </div>
    </div>
  );
}
