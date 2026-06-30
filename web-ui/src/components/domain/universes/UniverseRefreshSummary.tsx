import Badge from '@/components/common/Badge';
import type { UniverseRefreshRow } from '@/features/pool/admin';

interface UniverseRefreshSummaryProps {
  rows: UniverseRefreshRow[];
}

export default function UniverseRefreshSummary({ rows }: UniverseRefreshSummaryProps) {
  if (!rows.length) return null;
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-3 py-2">Universe</th>
            <th className="px-3 py-2">Before</th>
            <th className="px-3 py-2">After</th>
            <th className="px-3 py-2">Added</th>
            <th className="px-3 py-2">Removed</th>
            <th className="px-3 py-2">Applied</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border/50">
              <td className="px-3 py-2 font-medium text-foreground">{row.id}</td>
              {row.error ? (
                <td className="px-3 py-2" colSpan={5}>
                  <span title={row.error} className="cursor-help">
                    <Badge variant="error">Error</Badge>
                  </span>
                </td>
              ) : (
                <>
                  <td className="px-3 py-2 text-muted">{row.currentMemberCount ?? '—'}</td>
                  <td className="px-3 py-2 text-muted">{row.proposedMemberCount ?? '—'}</td>
                  <td className="px-3 py-2 text-success">{row.additions.length ? row.additions.join(', ') : '—'}</td>
                  <td className="px-3 py-2 text-danger">{row.removals.length ? row.removals.join(', ') : '—'}</td>
                  <td className="px-3 py-2">{row.changed ? '✓' : '—'}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
