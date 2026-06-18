import { cn } from '@/utils/cn';

export type ReviewSectionId = 'decision' | 'setup' | 'risk';

export const REVIEW_SECTIONS: Array<{ id: ReviewSectionId; titleKey: string }> = [
  { id: 'decision', titleKey: 'order.review.sections.decision' },
  { id: 'setup', titleKey: 'order.review.sections.setup' },
  { id: 'risk', titleKey: 'order.review.sections.risk' },
];

export const CONCENTRATION_WARNING_THRESHOLD = 60;

const COUNTRY_SUFFIXES: Record<string, string> = {
  '.AS': 'NL',
  '.PA': 'FR',
  '.DE': 'DE',
  '.MC': 'ES',
  '.MI': 'IT',
  '.ST': 'SE',
  '.L': 'UK',
  '.BR': 'BE',
  '.LS': 'PT',
  '.HE': 'FI',
  '.CO': 'DK',
  '.OL': 'NO',
};

export function MetricTile({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={cn('mt-1 text-sm font-semibold text-foreground', emphasize && 'text-primary')}>
        {value}
      </p>
    </div>
  );
}

export function EmptySection({ body }: { body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-foreground/5 p-4 text-sm text-muted">
      {body}
    </div>
  );
}

export function classifyInvalidationRule(condition: string) {
  const normalized = condition.toLowerCase();
  if (
    normalized.includes('stop') ||
    normalized.includes('close') ||
    normalized.includes('breaks below') ||
    normalized.includes('invalid')
  ) {
    return 'hard';
  }
  return 'soft';
}

export function countryFromTicker(ticker: string): string {
  const normalized = ticker.trim().toUpperCase();
  for (const [suffix, country] of Object.entries(COUNTRY_SUFFIXES)) {
    if (normalized.endsWith(suffix)) return country;
  }
  return 'US';
}
