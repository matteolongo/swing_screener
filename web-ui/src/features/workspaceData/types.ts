export type WorkspaceSourceId =
  | 'screener'
  | 'prices'
  | 'fundamentals'
  | 'evidence'
  | 'intelligence'
  | 'positionOrders';

export type WorkspaceSourcePhase =
  | 'idle'
  | 'loading'
  | 'fresh'
  | 'cached'
  | 'stale'
  | 'partial'
  | 'failed';

export interface WorkspaceSourceState {
  id: WorkspaceSourceId;
  ticker: string;
  selectionVersion: number;
  phase: WorkspaceSourcePhase;
  provider: string | null;
  dataAsOf: string | null;
  fetchedAt: string | null;
  cacheOrigin: 'network' | 'memory' | 'disk' | null;
  missingInputs: string[];
  error: { message: string; retryable: boolean } | null;
  stateReason?: 'analysisNotGeneratedToday' | 'evidenceNotCached';
}

export type WorkspaceHealth = 'fresh' | 'mixed' | 'stale' | 'partial' | 'failed';
