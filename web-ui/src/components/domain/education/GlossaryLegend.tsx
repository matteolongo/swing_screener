import { EducationMetricKey, getGlossaryEntry } from '@/content/educationGlossary';
import { t } from '@/i18n/t';

interface GlossaryLegendProps {
  metricKeys: EducationMetricKey[];
  title?: string;
}

export default function GlossaryLegend({
  metricKeys,
  title,
}: GlossaryLegendProps) {
  const resolvedTitle = title ?? t('educationGlossary.title');

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
      <h3 className="text-sm font-semibold text-blue-900">{resolvedTitle}</h3>
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
