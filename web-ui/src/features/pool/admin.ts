import { API_ENDPOINTS } from '@/lib/api';
import { fetchJson } from '@/lib/fetchJson';

// --- Shared diff shapes -----------------------------------------------------

export interface PoolSymbolRow {
  symbol: string;
  region: string | null;
  exchangeMic: string | null;
  currency: string | null;
  capTier: string | null;
  sector: string | null;
  indexMemberships: string[];
}

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface ModifiedSymbol {
  symbol: string;
  changes: FieldChange[];
}

export interface PoolDiff {
  additions: PoolSymbolRow[];
  removals: PoolSymbolRow[];
  modifications: ModifiedSymbol[];
  summary: { added: number; removed: number; modified: number; unchanged: number };
}

interface PoolSymbolApi {
  symbol: string;
  region?: string | null;
  exchange_mic?: string | null;
  currency?: string | null;
  market_cap_tier?: string | null;
  sector?: string | null;
  index_memberships?: string[] | null;
}

function transformSymbolRow(s: PoolSymbolApi): PoolSymbolRow {
  return {
    symbol: s.symbol,
    region: s.region ?? null,
    exchangeMic: s.exchange_mic ?? null,
    currency: s.currency ?? null,
    capTier: s.market_cap_tier ?? null,
    sector: s.sector ?? null,
    indexMemberships: s.index_memberships ?? [],
  };
}

interface PoolDiffApi {
  applied?: boolean;
  additions: PoolSymbolApi[];
  removals: PoolSymbolApi[];
  modifications: ModifiedSymbol[];
  summary: { added: number; removed: number; modified: number; unchanged: number };
}

function transformDiff(body: PoolDiffApi): PoolDiff {
  return {
    additions: body.additions.map(transformSymbolRow),
    removals: body.removals.map(transformSymbolRow),
    modifications: body.modifications ?? [],
    summary: body.summary,
  };
}

// --- Rebuild ----------------------------------------------------------------

export async function rebuildPool(): Promise<PoolDiff> {
  const body = await fetchJson<PoolDiffApi>(API_ENDPOINTS.poolRebuild, {
    method: 'POST',
    errorMessage: 'Failed to rebuild symbol pool',
  });
  return transformDiff(body);
}

// --- Refresh all universes --------------------------------------------------

export interface UniverseRefreshRow {
  id: string;
  applied?: boolean;
  changed?: boolean;
  currentMemberCount?: number | null;
  proposedMemberCount?: number | null;
  additions: string[];
  removals: string[];
  error?: string;
}

export interface RefreshAllResult {
  universes: UniverseRefreshRow[];
  totalAdditions: number;
  totalRemovals: number;
  totalChanged: number;
}

interface UniverseRefreshApi {
  id: string;
  applied?: boolean;
  changed?: boolean;
  current_member_count?: number | null;
  proposed_member_count?: number | null;
  additions?: string[];
  removals?: string[];
  error?: string;
}

interface RefreshAllApi {
  universes: UniverseRefreshApi[];
  total_additions: number;
  total_removals: number;
  total_changed: number;
}

export async function refreshAllUniverses(): Promise<RefreshAllResult> {
  const body = await fetchJson<RefreshAllApi>(API_ENDPOINTS.universeRefreshAll, {
    method: 'POST',
    errorMessage: 'Failed to refresh universes',
  });
  return {
    universes: (body.universes ?? []).map((u) => ({
      id: u.id,
      applied: u.applied,
      changed: u.changed,
      currentMemberCount: u.current_member_count ?? null,
      proposedMemberCount: u.proposed_member_count ?? null,
      additions: u.additions ?? [],
      removals: u.removals ?? [],
      error: u.error,
    })),
    totalAdditions: body.total_additions,
    totalRemovals: body.total_removals,
    totalChanged: body.total_changed,
  };
}

// --- Enrich (async / poll) --------------------------------------------------

export interface EnrichProgress {
  processed: number;
  total: number;
  failed: number;
}

export interface EnrichDiff {
  modified: ModifiedSymbol[];
  failedSymbols: string[];
}

export interface EnrichStatus {
  status: 'running' | 'done' | 'failed';
  progress: EnrichProgress;
  error: string | null;
  diff: EnrichDiff | null;
}

interface EnrichStatusApi {
  status: 'running' | 'done' | 'failed';
  progress: EnrichProgress;
  error: string | null;
  diff: { modified: ModifiedSymbol[]; failed_symbols: string[] } | null;
}

export async function startEnrich(): Promise<string> {
  const body = await fetchJson<{ job_id: string }>(API_ENDPOINTS.poolEnrich, {
    method: 'POST',
    errorMessage: 'Failed to start enrichment',
  });
  return body.job_id;
}

export async function fetchEnrichStatus(jobId: string): Promise<EnrichStatus> {
  const body = await fetchJson<EnrichStatusApi>(API_ENDPOINTS.poolEnrichStatus(jobId), {
    errorMessage: 'Failed to fetch enrichment status',
  });
  return {
    status: body.status,
    progress: body.progress,
    error: body.error,
    diff: body.diff
      ? { modified: body.diff.modified ?? [], failedSymbols: body.diff.failed_symbols ?? [] }
      : null,
  };
}
