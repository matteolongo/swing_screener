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

export type WorkspaceActivityPhase =
  | 'active'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'discarded';

export interface WorkspaceActivity {
  requestId: string;
  ticker: string;
  selectionVersion: number;
  sourceId: WorkspaceSourceId;
  phase: WorkspaceActivityPhase;
  startedAt: string;
  finishedAt: string | null;
  provider: string | null;
  message: string | null;
  retryable: boolean;
  pipelineStep: string | null;
  announced: boolean;
}

export type WorkspaceActivitySettlement = Pick<
  WorkspaceActivity,
  'phase' | 'finishedAt'
> & Partial<Pick<WorkspaceActivity, 'provider' | 'message' | 'retryable' | 'pipelineStep'>>;
