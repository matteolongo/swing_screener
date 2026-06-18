import { t } from '@/i18n/t';

interface FundamentalsStripProps {
  trailingPe?: number | null;
  revenueGrowthYoy?: number | null;
  grossMargin?: number | null;
  valuationLabel?: string | null;
}

function pct(v: number | null | undefined): string | null {
  return typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : null;
}

export default function FundamentalsStrip({
  trailingPe,
  revenueGrowthYoy,
  grossMargin,
  valuationLabel,
}: FundamentalsStripProps) {
  const items = [
    { label: t('workspacePage.panels.analysis.fundamentalsStrip.pe'), value: typeof trailingPe === 'number' ? trailingPe.toFixed(1) : null },
    { label: t('workspacePage.panels.analysis.fundamentalsStrip.revenueGrowth'), value: pct(revenueGrowthYoy) },
    { label: t('workspacePage.panels.analysis.fundamentalsStrip.grossMargin'), value: pct(grossMargin) },
    { label: t('workspacePage.panels.analysis.fundamentalsStrip.valuation'), value: valuationLabel ?? null },
  ].filter((i) => i.value);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-3 text-sm text-muted">
        {t('workspacePage.panels.analysis.fundamentalsStrip.unavailable')}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
        {t('workspacePage.panels.analysis.fundamentalsStrip.title')}
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {items.map((i) => (
          <div key={i.label} className="rounded-md border border-border bg-surface px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted">{i.label}</div>
            <div className="mt-1 text-sm font-semibold text-foreground">{i.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
