export type ProbeStatus = 'ok' | 'degraded' | 'down' | 'not_configured';
export type SourceRole = 'primary' | 'fallback' | 'enrichment';

export interface ProbeResultAPI {
  id: string;
  status: ProbeStatus;
  latency_ms: number | null;
  detail: string | null;
  sample: Record<string, unknown> | null;
  error: string | null;
}

export interface DataSourceAPI {
  id: string;
  display_name: string;
  domain: string;
  role: SourceRole;
  requires: string | null;
  configured: boolean;
  probeable: boolean;
  canary_market: string | null;
  note: string | null;
  last_probe: ProbeResultAPI | null;
}

export interface DataSourcesInventoryAPI {
  sources: DataSourceAPI[];
}

export interface FallbackEventAPI {
  ts: string;
  domain: string;
  from_provider: string;
  reason: string;
  fell_back_to: string | null;
  tickers: string[];
  stale_asof: string | null;
}

export interface FallbackEventsAPI {
  events: FallbackEventAPI[];
}

export interface ProbeResult {
  id: string;
  status: ProbeStatus;
  latencyMs?: number;
  detail?: string;
  sample?: Record<string, unknown>;
  error?: string;
}

export interface DataSource {
  id: string;
  displayName: string;
  domain: string;
  role: SourceRole;
  requires?: string;
  configured: boolean;
  probeable: boolean;
  canaryMarket?: string;
  note?: string;
  lastProbe?: ProbeResult;
}

export interface FallbackEvent {
  ts: string;
  domain: string;
  fromProvider: string;
  reason: string;
  fellBackTo?: string;
  tickers: string[];
  staleAsof?: string;
}

export function transformProbeResult(api: ProbeResultAPI): ProbeResult {
  return {
    id: api.id,
    status: api.status,
    latencyMs: api.latency_ms ?? undefined,
    detail: api.detail ?? undefined,
    sample: api.sample ?? undefined,
    error: api.error ?? undefined,
  };
}

export function transformDataSource(api: DataSourceAPI): DataSource {
  return {
    id: api.id,
    displayName: api.display_name,
    domain: api.domain,
    role: api.role,
    requires: api.requires ?? undefined,
    configured: api.configured,
    probeable: api.probeable,
    canaryMarket: api.canary_market ?? undefined,
    note: api.note ?? undefined,
    lastProbe: api.last_probe ? transformProbeResult(api.last_probe) : undefined,
  };
}

export function transformFallbackEvent(api: FallbackEventAPI): FallbackEvent {
  return {
    ts: api.ts,
    domain: api.domain,
    fromProvider: api.from_provider,
    reason: api.reason,
    fellBackTo: api.fell_back_to ?? undefined,
    tickers: api.tickers ?? [],
    staleAsof: api.stale_asof ?? undefined,
  };
}
