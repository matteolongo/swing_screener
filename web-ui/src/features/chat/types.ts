import type { ScreenerCandidate, ScreenerResponse } from '@/features/screener/types';

export type ChatRole = 'user' | 'assistant';
export type WorkspaceFreshnessSource = 'portfolio' | 'screener' | 'intelligence' | 'education';

export interface ChatTurn {
  role: ChatRole;
  content: string;
  createdAt?: string;
}

export interface WorkspaceSnapshotCandidate {
  ticker: string;
  currency?: 'USD' | 'EUR';
  name?: string;
  sector?: string;
  rank?: number;
  score?: number;
  confidence?: number;
  signal?: string;
  close?: number;
  entry?: number;
  stop?: number;
  target?: number;
  rr?: number;
  shares?: number;
  positionSizeUsd?: number;
  riskUsd?: number;
  riskPct?: number;
  recommendationVerdict?: string;
  reasonsShort: string[];
  beginnerExplanation?: string;
}

export interface WorkspaceSnapshot {
  asofDate?: string;
  dataFreshness?: 'final_close' | 'intraday';
  totalScreened?: number;
  candidates: WorkspaceSnapshotCandidate[];
}

export interface WorkspaceContextSourceMeta {
  source: WorkspaceFreshnessSource;
  label: string;
  loaded: boolean;
  origin: string;
  asof?: string;
  count: number;
}

export interface WorkspaceContextMeta {
  selectedTicker?: string;
  sources: WorkspaceContextSourceMeta[];
}

export interface ChatAnswerRequest {
  question: string;
  conversation: ChatTurn[];
  selectedTicker?: string;
  workspaceSnapshot?: WorkspaceSnapshot;
}

export interface ChatAnswerResponse {
  answer: string;
  warnings: string[];
  factsUsed: string[];
  contextMeta: WorkspaceContextMeta;
  conversationState: ChatTurn[];
}

interface ChatTurnAPI {
  role: ChatRole;
  content: string;
  created_at?: string;
}

interface WorkspaceSnapshotCandidateAPI {
  ticker: string;
  currency?: 'USD' | 'EUR';
  name?: string;
  sector?: string;
  rank?: number;
  score?: number;
  confidence?: number;
  signal?: string;
  close?: number;
  entry?: number;
  stop?: number;
  target?: number;
  rr?: number;
  shares?: number;
  position_size_usd?: number;
  risk_usd?: number;
  risk_pct?: number;
  recommendation_verdict?: string;
  reasons_short?: string[];
  beginner_explanation?: string;
}

interface WorkspaceSnapshotAPI {
  asof_date?: string;
  data_freshness?: 'final_close' | 'intraday';
  total_screened?: number;
  candidates: WorkspaceSnapshotCandidateAPI[];
}

interface WorkspaceContextSourceMetaAPI {
  source: WorkspaceFreshnessSource;
  label: string;
  loaded: boolean;
  origin: string;
  asof?: string;
  count: number;
}

interface WorkspaceContextMetaAPI {
  selected_ticker?: string;
  sources: WorkspaceContextSourceMetaAPI[];
}

interface ChatAnswerRequestAPI {
  question: string;
  conversation: ChatTurnAPI[];
  selected_ticker?: string;
  workspace_snapshot?: WorkspaceSnapshotAPI;
}

export interface ChatAnswerResponseAPI {
  answer: string;
  warnings?: string[];
  facts_used?: string[];
  context_meta: WorkspaceContextMetaAPI;
  conversation_state?: ChatTurnAPI[];
}

function buildSnapshotCandidate(candidate: ScreenerCandidate): WorkspaceSnapshotCandidate {
  return {
    ticker: candidate.ticker,
    currency: candidate.currency,
    name: candidate.name,
    sector: candidate.sector,
    rank: candidate.rank,
    score: candidate.score,
    confidence: candidate.confidence,
    signal: candidate.signal,
    close: candidate.close,
    entry: candidate.entry,
    stop: candidate.stop,
    target: candidate.target,
    rr: candidate.rr,
    shares: candidate.shares,
    positionSizeUsd: candidate.positionSizeUsd,
    riskUsd: candidate.riskUsd,
    riskPct: candidate.riskPct,
    recommendationVerdict: candidate.recommendation?.verdict,
    reasonsShort: candidate.recommendation?.reasonsShort ?? [],
    beginnerExplanation:
      candidate.recommendation?.thesis?.beginnerExplanation?.text ??
      candidate.recommendation?.thesis?.explanation?.keyInsight,
  };
}

export function buildWorkspaceSnapshot(result?: ScreenerResponse | null): WorkspaceSnapshot | undefined {
  if (!result) {
    return undefined;
  }
  return {
    asofDate: result.asofDate,
    dataFreshness: result.dataFreshness,
    totalScreened: result.totalScreened,
    candidates: result.candidates.map(buildSnapshotCandidate),
  };
}

export function toChatAnswerRequestAPI(request: ChatAnswerRequest): ChatAnswerRequestAPI {
  return {
    question: request.question,
    conversation: request.conversation.map((turn) => ({
      role: turn.role,
      content: turn.content,
      created_at: turn.createdAt,
    })),
    selected_ticker: request.selectedTicker,
    workspace_snapshot: request.workspaceSnapshot
      ? {
          asof_date: request.workspaceSnapshot.asofDate,
          data_freshness: request.workspaceSnapshot.dataFreshness,
          total_screened: request.workspaceSnapshot.totalScreened,
          candidates: request.workspaceSnapshot.candidates.map((candidate) => ({
            ticker: candidate.ticker,
            currency: candidate.currency,
            name: candidate.name,
            sector: candidate.sector,
            rank: candidate.rank,
            score: candidate.score,
            confidence: candidate.confidence,
            signal: candidate.signal,
            close: candidate.close,
            entry: candidate.entry,
            stop: candidate.stop,
            target: candidate.target,
            rr: candidate.rr,
            shares: candidate.shares,
            position_size_usd: candidate.positionSizeUsd,
            risk_usd: candidate.riskUsd,
            risk_pct: candidate.riskPct,
            recommendation_verdict: candidate.recommendationVerdict,
            reasons_short: candidate.reasonsShort,
            beginner_explanation: candidate.beginnerExplanation,
          })),
        }
      : undefined,
  };
}

export function transformChatAnswerResponse(payload: ChatAnswerResponseAPI): ChatAnswerResponse {
  return {
    answer: payload.answer,
    warnings: payload.warnings ?? [],
    factsUsed: payload.facts_used ?? [],
    contextMeta: {
      selectedTicker: payload.context_meta.selected_ticker,
      sources: payload.context_meta.sources.map((source) => ({
        source: source.source,
        label: source.label,
        loaded: source.loaded,
        origin: source.origin,
        asof: source.asof,
        count: source.count,
      })),
    },
    conversationState: (payload.conversation_state ?? []).map((turn) => ({
      role: turn.role,
      content: turn.content,
      createdAt: turn.created_at,
    })),
  };
}
