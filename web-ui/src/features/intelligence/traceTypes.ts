export interface StepTraceAPI {
  name: string;
  status: 'ok' | 'error' | 'running';
  started_at: string;
  finished_at: string;
  duration_ms: number;
  outputs_summary: Record<string, unknown>;
  error: string | null;
  model: string | null;
  tokens: number | null;
  source_counts: Record<string, number> | null;
  prompt_hash: string | null;
  prompt_preview: string | null;
}

export interface RunTraceAPI {
  run_id: string;
  ticker: string;
  started_at: string;
  finished_at: string | null;
  status: 'ok' | 'error' | 'running';
  steps: StepTraceAPI[];
  error: string | null;
  client_attempt_id?: string | null;
  attempt_force?: boolean | null;
}

export interface RunIndexEntryAPI {
  run_id: string;
  ticker: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  duration_ms: number | null;
  step_count: number;
  client_attempt_id?: string | null;
  attempt_force?: boolean | null;
}

export interface StepTrace {
  name: string;
  status: 'ok' | 'error' | 'running';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  outputsSummary: Record<string, unknown>;
  error: string | null;
  model: string | null;
  tokens: number | null;
  sourceCounts: Record<string, number> | null;
  promptHash: string | null;
  promptPreview: string | null;
}

export interface RunTrace {
  runId: string;
  ticker: string;
  startedAt: string;
  finishedAt: string | null;
  status: 'ok' | 'error' | 'running';
  steps: StepTrace[];
  error: string | null;
  clientAttemptId?: string | null;
  attemptForce?: boolean | null;
}

export interface RunIndexEntry {
  runId: string;
  ticker: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  durationMs: number | null;
  stepCount: number;
  clientAttemptId?: string | null;
  attemptForce?: boolean | null;
}

export function transformStepTrace(api: StepTraceAPI): StepTrace {
  return {
    name: api.name,
    status: api.status,
    startedAt: api.started_at,
    finishedAt: api.finished_at,
    durationMs: api.duration_ms,
    outputsSummary: api.outputs_summary ?? {},
    error: api.error ?? null,
    model: api.model ?? null,
    tokens: api.tokens ?? null,
    sourceCounts: api.source_counts ?? null,
    promptHash: api.prompt_hash ?? null,
    promptPreview: api.prompt_preview ?? null,
  };
}

export function transformRunTrace(api: RunTraceAPI): RunTrace {
  return {
    runId: api.run_id,
    ticker: api.ticker,
    startedAt: api.started_at,
    finishedAt: api.finished_at ?? null,
    status: api.status,
    steps: (api.steps ?? []).map(transformStepTrace),
    error: api.error ?? null,
    clientAttemptId: api.client_attempt_id ?? null,
    attemptForce: api.attempt_force ?? null,
  };
}

export function transformRunIndexEntry(api: RunIndexEntryAPI): RunIndexEntry {
  return {
    runId: api.run_id,
    ticker: api.ticker,
    startedAt: api.started_at,
    finishedAt: api.finished_at ?? null,
    status: api.status,
    durationMs: api.duration_ms ?? null,
    stepCount: api.step_count ?? 0,
    clientAttemptId: api.client_attempt_id ?? null,
    attemptForce: api.attempt_force ?? null,
  };
}
