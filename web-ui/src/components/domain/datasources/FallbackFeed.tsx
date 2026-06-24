import { t } from '@/i18n/t';
import type { FallbackEvent } from '@/features/datasources/types';

export default function FallbackFeed({ events }: { events: FallbackEvent[] }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-3">
      <h2 className="text-sm font-medium text-foreground mb-2">{t('datasources.fallbacks.title')}</h2>
      {events.length === 0 ? (
        <p className="text-xs text-muted">{t('datasources.fallbacks.empty')}</p>
      ) : (
        <ul className="space-y-1">
          {events.map((e, i) => (
            <li key={`${e.ts}-${i}`} className="text-xs text-muted">
              <span className="text-foreground">{e.fromProvider}</span>
              {e.fellBackTo ? ` → ${e.fellBackTo}` : ''} · {e.reason}
              {e.tickers.length ? ` · ${e.tickers.slice(0, 5).join(', ')}` : ''}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
