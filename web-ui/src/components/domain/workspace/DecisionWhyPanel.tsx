import type { DecisionSummary } from '@/features/screener/types';
import { t } from '@/i18n/t';

interface DecisionWhyPanelProps {
  summary?: DecisionSummary | null;
  aiSummaryLine?: string | null;
}

export default function DecisionWhyPanel({ summary, aiSummaryLine }: DecisionWhyPanelProps) {
  if (!summary) {
    return (
      <div className="rounded-lg border border-slate-200 bg-surface p-3">
        <p className="text-sm text-slate-500">
          {t('workspacePage.panels.analysis.decisionWhy.noGuidance')}
        </p>
      </div>
    );
  }

  const whyNow = [summary.whyNow, aiSummaryLine].filter(Boolean).join(' · ');
  const rows = [
    { label: t('workspacePage.panels.analysis.decisionWhy.whatToDo'), value: summary.whatToDo },
    { label: t('workspacePage.panels.analysis.decisionWhy.whyNow'), value: whyNow },
    { label: t('workspacePage.panels.analysis.decisionWhy.watchFor'), value: summary.mainRisk },
  ].filter((r) => r.value);

  return (
    <div className="rounded-lg border border-slate-200 bg-surface p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {t('workspacePage.panels.analysis.decisionWhy.title')}
      </div>
      <dl className="mt-2 grid gap-2">
        {rows.map((r) => (
          <div key={r.label} className="rounded-md bg-slate-50 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{r.label}</dt>
            <dd className="mt-1 text-sm text-slate-800">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
