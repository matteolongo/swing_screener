import Card from '@/components/common/Card';
import type { UniverseDetail } from '@/features/universes/types';

interface UniverseConstituentsTabProps {
  detail: UniverseDetail | undefined;
}

export default function UniverseConstituentsTab({ detail }: UniverseConstituentsTabProps) {
  return (
    <Card variant="bordered" className="p-4">
      {!detail ? (
        <div className="py-8 text-center text-sm text-muted">Select a universe to view its constituents.</div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Constituents</h3>
            <div className="text-xs text-muted">{detail.constituents.length} rows</div>
          </div>
          <div className="max-h-[520px] overflow-auto rounded-xl border border-border">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2">Symbol</th>
                  <th className="px-3 py-2">Source Name</th>
                  <th className="px-3 py-2">Exchange</th>
                  <th className="px-3 py-2">Currency</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {detail.constituents.map((constituent) => (
                  <tr key={constituent.symbol}>
                    <td className="px-3 py-2 font-medium text-foreground">{constituent.symbol}</td>
                    <td className="px-3 py-2 text-muted">{constituent.source_name ?? constituent.source_symbol ?? constituent.symbol}</td>
                    <td className="px-3 py-2 text-muted">{constituent.exchange_mic ?? '—'}</td>
                    <td className="px-3 py-2 text-muted">{constituent.currency ?? '—'}</td>
                    <td className="px-3 py-2 text-muted">{constituent.instrument_type ?? '—'}</td>
                    <td className="px-3 py-2 text-muted">{constituent.status ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
