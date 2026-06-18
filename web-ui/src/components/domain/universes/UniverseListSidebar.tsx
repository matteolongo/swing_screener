import { Database } from 'lucide-react';

import Card from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import type { UniverseSummary } from '@/features/screener/types';
import { freshnessLabel, freshnessVariant, sourceLabel } from './universesShared';

interface UniverseListSidebarProps {
  universes: UniverseSummary[];
  selectedUniverseId: string | null;
  isLoading: boolean;
  isError: boolean;
  onSelect: (id: string) => void;
}

export default function UniverseListSidebar({
  universes,
  selectedUniverseId,
  isLoading,
  isError,
  onSelect,
}: UniverseListSidebarProps) {
  return (
    <Card variant="bordered" className="p-3">
      <div className="mb-3 flex items-center gap-2">
        <Database className="h-4 w-4 text-muted" />
        <h2 className="text-sm font-semibold text-foreground">Configured Universes</h2>
      </div>
      {isLoading ? (
        <div className="text-sm text-muted">Loading universe catalog…</div>
      ) : isError ? (
        <div className="text-sm text-danger">Failed to load universe catalog.</div>
      ) : (
        <div className="space-y-2">
          {universes.map((universe) => {
            const selected = universe.id === selectedUniverseId;
            return (
              <button
                key={universe.id}
                type="button"
                onClick={() => onSelect(universe.id)}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  selected
                    ? 'border-success/40 bg-success/10'
                    : 'border-border bg-surface hover:border-border hover:bg-foreground/5'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{universe.description}</div>
                    <div className="mt-1 text-xs text-muted">{universe.id}</div>
                  </div>
                  <Badge variant={freshnessVariant(universe.freshness_status)}>
                    {freshnessLabel(universe.freshness_status)}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
                  <span>{universe.member_count} members</span>
                  <span>{sourceLabel(universe.source)}</span>
                  <span>as of {universe.source_asof}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
