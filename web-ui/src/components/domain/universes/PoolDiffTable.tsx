import { useState } from 'react';

import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import type { ModifiedSymbol, PoolSymbolRow } from '@/features/pool/admin';

type DiffTab = 'additions' | 'removals' | 'modified' | 'failed';

interface PoolDiffTableProps {
  additions?: PoolSymbolRow[];
  removals?: PoolSymbolRow[];
  modifications: ModifiedSymbol[];
  failedSymbols?: string[];
}

function formatValue(value: unknown): string {
  if (value == null) return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  return String(value);
}

function SymbolRowTable({ rows }: { rows: PoolSymbolRow[] }) {
  if (!rows.length) return <EmptyState />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-3 py-2">{t('poolAdmin.diff.symbol')}</th>
            <th className="px-3 py-2">{t('poolAdmin.diff.region')}</th>
            <th className="px-3 py-2">{t('poolAdmin.diff.exchange')}</th>
            <th className="px-3 py-2">{t('poolAdmin.diff.currency')}</th>
            <th className="px-3 py-2">{t('poolAdmin.diff.capTier')}</th>
            <th className="px-3 py-2">{t('poolAdmin.diff.sector')}</th>
            <th className="px-3 py-2">{t('poolAdmin.diff.indexMemberships')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.symbol} className="border-b border-border/50">
              <td className="px-3 py-2 font-medium text-foreground">{row.symbol}</td>
              <td className="px-3 py-2 text-muted">{formatValue(row.region)}</td>
              <td className="px-3 py-2 text-muted">{formatValue(row.exchangeMic)}</td>
              <td className="px-3 py-2 text-muted">{formatValue(row.currency)}</td>
              <td className="px-3 py-2 text-muted">{formatValue(row.capTier)}</td>
              <td className="px-3 py-2 text-muted">{formatValue(row.sector)}</td>
              <td className="px-3 py-2 text-muted">{formatValue(row.indexMemberships)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModifiedTable({ rows }: { rows: ModifiedSymbol[] }) {
  if (!rows.length) return <EmptyState />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-3 py-2">{t('poolAdmin.diff.symbol')}</th>
            <th className="px-3 py-2">{t('poolAdmin.diff.field')}</th>
            <th className="px-3 py-2">{t('poolAdmin.diff.before')}</th>
            <th className="px-3 py-2">{t('poolAdmin.diff.after')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) =>
            row.changes.map((change, idx) => (
              <tr
                key={`${row.symbol}-${change.field}`}
                className={cn('border-b border-border/50', idx > 0 && 'border-l-2 border-l-border')}
              >
                <td className="px-3 py-2 font-medium text-foreground">
                  {idx === 0 ? row.symbol : ''}
                </td>
                <td className="px-3 py-2 text-muted">{change.field}</td>
                <td className="px-3 py-2 text-danger">{formatValue(change.before)}</td>
                <td className="px-3 py-2 text-success">{formatValue(change.after)}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}

function FailedTable({ symbols }: { symbols: string[] }) {
  if (!symbols.length) return <EmptyState />;
  return (
    <div className="flex flex-wrap gap-2 p-1">
      {symbols.map((sym) => (
        <span key={sym} className="rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-medium text-danger">
          {sym}
        </span>
      ))}
    </div>
  );
}

function EmptyState() {
  return <div className="py-6 text-center text-sm text-muted">{t('poolAdmin.diff.none')}</div>;
}

export default function PoolDiffTable({
  additions,
  removals,
  modifications,
  failedSymbols,
}: PoolDiffTableProps) {
  const hasAddRemove = additions !== undefined || removals !== undefined;
  const hasFailed = failedSymbols !== undefined;
  const [tab, setTab] = useState<DiffTab>(hasAddRemove ? 'additions' : 'modified');

  const tabs: { id: DiffTab; label: string; count: number }[] = [];
  if (hasAddRemove) {
    tabs.push({ id: 'additions', label: t('poolAdmin.diff.additions'), count: additions?.length ?? 0 });
    tabs.push({ id: 'removals', label: t('poolAdmin.diff.removals'), count: removals?.length ?? 0 });
  }
  tabs.push({ id: 'modified', label: t('poolAdmin.diff.modified'), count: modifications.length });
  if (hasFailed) {
    tabs.push({ id: 'failed', label: t('poolAdmin.diff.failed'), count: failedSymbols?.length ?? 0 });
  }

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex border-b border-border">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            disabled={entry.count === 0}
            onClick={() => setTab(entry.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40',
              tab === entry.id ? 'border-b-2 border-primary text-primary' : 'text-muted hover:text-foreground',
            )}
          >
            {entry.label} ({entry.count})
          </button>
        ))}
      </div>
      <div className="p-2">
        {tab === 'additions' && <SymbolRowTable rows={additions ?? []} />}
        {tab === 'removals' && <SymbolRowTable rows={removals ?? []} />}
        {tab === 'modified' && <ModifiedTable rows={modifications} />}
        {tab === 'failed' && <FailedTable symbols={failedSymbols ?? []} />}
      </div>
    </div>
  );
}
