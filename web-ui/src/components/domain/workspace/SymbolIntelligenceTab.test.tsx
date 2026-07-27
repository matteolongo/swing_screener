import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { t } from '@/i18n/t';
import { renderWithProviders } from '@/test/utils';
import type { SymbolIntelligence } from '@/features/intelligence/types';
import type { RunTrace } from '@/features/intelligence/traceTypes';
import type { WorkspaceSourceState } from '@/features/workspaceData/types';
import SymbolIntelligenceTab, { type SymbolIntelligenceTabModel } from './SymbolIntelligenceTab';

vi.mock('./PositionReviewPanel', () => ({ default: () => <div>position review</div> }));
vi.mock('./StrategicReviewPanel', () => ({ default: () => <div>strategic review</div> }));
vi.mock('./IntelligenceChatPanel', () => ({ default: () => <div>chat</div> }));
vi.mock('./NarrativeAnalysisCard', () => ({ default: () => <div>narrative report</div> }));
vi.mock('./AgentTracePanel', () => ({ default: () => <div>trace detail</div> }));

const source = (
  id: WorkspaceSourceState['id'],
  overrides: Partial<WorkspaceSourceState> = {},
): WorkspaceSourceState => ({
  id,
  ticker: 'AAPL',
  selectionVersion: 4,
  phase: 'fresh',
  provider: id === 'fundamentals' ? 'sec-companyfacts' : 'workspace',
  dataAsOf: '2026-07-27T20:00:00Z',
  fetchedAt: '2026-07-27T20:01:00Z',
  cacheOrigin: 'network',
  missingInputs: [],
  error: null,
  ...overrides,
});

const analysis: SymbolIntelligence = {
  symbol: 'AAPL',
  generatedAt: '2026-07-27T19:00:00Z',
  runId: 'run-1',
  action: 'WATCH',
  conviction: 'medium',
  catalystUrgency: 'low',
  summaryLine: 'Evidence is constructive, but wait for confirmation.',
  narrative: 'The setup remains technically constructive with mixed catalyst support.',
  upcomingEvents: [],
  positionSignal: null,
  sources: ['sec-companyfacts'],
  inputsUsed: {
    enrichmentDiagnostics: [
      {
        source: 'fundamentals',
        status: 'used',
        asOf: '2026-07-27T20:00:00Z',
        itemCount: 1,
        message: null,
      },
    ],
  },
  evidenceLedger: null,
  classifiedCatalysts: [],
};

const baseModel: SymbolIntelligenceTabModel = {
  ticker: 'AAPL',
  selectionVersion: 4,
  candidate: null,
  position: null,
  analysis: null,
  intelligenceOutdated: false,
  sources: [source('prices'), source('fundamentals'), source('evidence')],
  trace: null,
  isLoadingAnalysis: false,
  isCachedAnalysis: false,
  isGenerating: false,
  isRefreshingEvidence: false,
  generationError: null,
  refreshError: null,
  onRefreshEvidence: vi.fn(),
  onGenerate: vi.fn(),
};

describe('SymbolIntelligenceTab guided flow', () => {
  it('requires an explicit generation action and shows the input manifest first', () => {
    const onGenerate = vi.fn();
    renderWithProviders(
      <SymbolIntelligenceTab model={{ ...baseModel, onGenerate }} />,
    );

    expect(
      screen.getByRole('table', { name: t('workspacePage.intelligence.inputs.title') }),
    ).toBeVisible();
    expect(
      screen.getByText(t('workspacePage.intelligence.sources.fundamentals')),
    ).toBeVisible();
    expect(onGenerate).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: t('workspacePage.intelligence.generate') }),
    ).toBeEnabled();
  });

  it('shows the failed pipeline step and keeps completed inputs visible', () => {
    const trace: RunTrace = {
      runId: 'run-1',
      ticker: 'AAPL',
      startedAt: '2026-07-27T20:00:00Z',
      finishedAt: '2026-07-27T20:00:02Z',
      status: 'error',
      error: 'Formatting failed.',
      steps: [
        {
          name: 'enrich_request',
          status: 'ok',
          startedAt: '2026-07-27T20:00:00Z',
          finishedAt: '2026-07-27T20:00:01Z',
          durationMs: 1000,
          outputsSummary: {},
          error: null,
          model: null,
          tokens: null,
          sourceCounts: null,
          promptHash: null,
          promptPreview: null,
        },
        {
          name: 'format',
          status: 'error',
          startedAt: '2026-07-27T20:00:01Z',
          finishedAt: '2026-07-27T20:00:02Z',
          durationMs: 1000,
          outputsSummary: {},
          error: 'Formatting failed.',
          model: null,
          tokens: null,
          sourceCounts: null,
          promptHash: null,
          promptPreview: null,
        },
      ],
    };

    renderWithProviders(
      <SymbolIntelligenceTab model={{ ...baseModel, analysis, trace }} />,
    );

    expect(screen.getByText(t('workspacePage.intelligence.steps.formatting'))).toHaveAttribute(
      'data-status',
      'failed',
    );
    expect(screen.getByText(t('workspacePage.intelligence.steps.enriching'))).toHaveAttribute(
      'data-status',
      'complete',
    );
    expect(
      screen.getByRole('button', { name: t('workspacePage.data.retry') }),
    ).toBeEnabled();
    expect(
      screen.getByText(t('workspacePage.intelligence.sources.fundamentals')),
    ).toBeVisible();
  });

  it('marks analysis outdated when a dependency is newer without hiding the result', () => {
    renderWithProviders(
      <SymbolIntelligenceTab
        model={{ ...baseModel, analysis, intelligenceOutdated: true }}
      />,
    );

    expect(screen.getByText(t('workspacePage.intelligence.outdated'))).toBeVisible();
    expect(screen.getByText(analysis.summaryLine)).toBeVisible();
  });

  it('keeps evidence refresh, generation, and forced regeneration as distinct actions', async () => {
    const onRefreshEvidence = vi.fn();
    const onGenerate = vi.fn();
    renderWithProviders(
      <SymbolIntelligenceTab
        model={{ ...baseModel, analysis, onRefreshEvidence, onGenerate }}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: t('workspacePage.intelligence.refreshEvidence') }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: t('workspacePage.intelligence.generate') }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: t('workspacePage.intelligence.forceRefresh') }),
    );

    expect(onRefreshEvidence).toHaveBeenCalledOnce();
    expect(onGenerate).toHaveBeenNthCalledWith(1, false);
    expect(onGenerate).toHaveBeenNthCalledWith(2, true);
  });
});
