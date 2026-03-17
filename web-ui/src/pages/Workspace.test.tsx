import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import WorkspacePage from './Workspace';
import { renderWithProviders } from '@/test/utils';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

vi.mock('@/components/domain/workspace/AnalysisCanvasPanel', () => ({
  default: () => <div data-testid="analysis-canvas-panel" />,
}));

vi.mock('@/components/domain/workspace/FloatingChatWidget', () => ({
  default: () => <div data-testid="workspace-chat-entrypoint" />,
}));

vi.mock('@/components/domain/workspace/PortfolioPanel', () => ({
  default: () => <div data-testid="portfolio-panel" />,
}));

vi.mock('@/components/domain/workspace/ScreenerInboxPanel', () => ({
  default: () => <div data-testid="screener-inbox-panel" />,
}));

vi.mock('@/components/domain/onboarding/TodaysNextActionCard', () => ({
  default: () => <div data-testid="next-action-card" />,
}));

vi.mock('@/features/intelligence/useSymbolIntelligenceRunner', () => ({
  useSymbolIntelligenceRunner: () => ({
    runForTicker: vi.fn(),
    getStatusForTicker: vi.fn(),
  }),
}));

describe('WorkspacePage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    useOnboardingStore.setState({ status: 'completed', currentStep: 0 });
    useWorkspaceStore.setState({ selectedTicker: null, selectedTickerSource: null, analysisTab: 'overview' });
  });

  it('renders exactly one workspace chat entrypoint', () => {
    renderWithProviders(<WorkspacePage />, { route: '/workspace' });

    expect(screen.getAllByTestId('workspace-chat-entrypoint')).toHaveLength(1);
  });
});
