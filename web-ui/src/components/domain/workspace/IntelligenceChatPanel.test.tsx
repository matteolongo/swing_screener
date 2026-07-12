import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import IntelligenceChatPanel from './IntelligenceChatPanel';
import * as intelligenceHooks from '@/features/intelligence/hooks';
import type { IntelligenceChatResponse, SymbolIntelligence } from '@/features/intelligence/types';
import { t } from '@/i18n/t';
import { renderWithProviders } from '@/test/utils';

vi.mock('@/features/intelligence/hooks', () => ({
  useIntelligenceChatQuery: vi.fn(),
  useSendIntelligenceChatMutation: vi.fn(),
}));

const baseIntelligence: SymbolIntelligence = {
  symbol: 'AAPL',
  generatedAt: '2026-07-03T08:00:00Z',
  action: 'BUY_NOW',
  conviction: 'high',
  catalystUrgency: 'medium',
  summaryLine: 'Breakout setup.',
  narrative: 'Watch guidance.',
  upcomingEvents: [],
  positionSignal: null,
  sources: [],
  evidenceLedger: null,
  classifiedCatalysts: [],
};

const emptyChat: IntelligenceChatResponse = {
  ticker: 'AAPL',
  chatDate: '2026-07-03',
  analysisGeneratedAt: '2026-07-03T08:00:00Z',
  refreshedAt: null,
  messages: [],
};

describe('IntelligenceChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(intelligenceHooks.useIntelligenceChatQuery).mockReturnValue({
      data: emptyChat,
      isLoading: false,
      isError: false,
      error: null,
    } as never);
    vi.mocked(intelligenceHooks.useSendIntelligenceChatMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as never);
  });

  it('is disabled until an intelligence analysis exists', () => {
    renderWithProviders(<IntelligenceChatPanel ticker="AAPL" intelligence={null} />);

    expect(screen.getAllByText(t('workspacePage.panels.analysis.intelligence.chat.disabled')).length).toBeGreaterThan(0);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('sends the message with refreshSources from the toggle', async () => {
    const mutate = vi.fn();
    vi.mocked(intelligenceHooks.useSendIntelligenceChatMutation).mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    } as never);
    const { user } = renderWithProviders(<IntelligenceChatPanel ticker="AAPL" intelligence={baseIntelligence} />);

    await user.type(screen.getByRole('textbox'), 'Refresh sources first');
    await user.click(screen.getByLabelText('Use latest sources (slower)'));
    await user.click(screen.getByRole('button', { name: t('workspacePage.panels.analysis.intelligence.chat.send') }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Refresh sources first',
        refreshSources: true,
        analysisGeneratedAt: '2026-07-03T08:00:00Z',
      }));
    });
  });

  it('renders assistant evidence only when evidence exists', () => {
    vi.mocked(intelligenceHooks.useIntelligenceChatQuery).mockReturnValue({
      data: {
        ticker: 'AAPL',
        chatDate: '2026-07-03',
        analysisGeneratedAt: '2026-07-03T08:00:00Z',
        refreshedAt: '2026-07-03T10:00:00Z',
        messages: [
          {
            id: 'u1',
            role: 'user',
            content: 'Check sources',
            createdAt: '2026-07-03T09:00:00Z',
            refreshSources: true,
            evidenceUsed: [],
          },
          {
            id: 'a1',
            role: 'assistant',
            content: 'Supplier evidence improved.',
            createdAt: '2026-07-03T09:00:01Z',
            refreshSources: true,
            evidenceUsed: [
              {
                label: 'Supplier update',
                source: 'Example News',
                url: 'https://example.com/source',
                date: '2026-07-03',
                summary: 'Supplier checks improved.',
              },
            ],
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    renderWithProviders(<IntelligenceChatPanel ticker="AAPL" intelligence={baseIntelligence} />);

    expect(screen.getByText('Supplier evidence improved.')).toBeInTheDocument();
    expect(screen.getByText(t('workspacePage.panels.analysis.intelligence.chat.evidenceUsed'))).toBeInTheDocument();
    expect(screen.getByText('Supplier update')).toBeInTheDocument();
  });

  it('does not display messages from a prior analysis revision after refresh', () => {
    vi.mocked(intelligenceHooks.useIntelligenceChatQuery).mockReturnValue({
      data: {
        ticker: 'AAPL',
        chatDate: '2026-07-03',
        analysisGeneratedAt: '2026-07-03T08:00:00Z',
        refreshedAt: null,
        messages: [{
          id: 'old',
          role: 'assistant',
          content: 'Old-revision answer',
          createdAt: '2026-07-03T08:01:00Z',
          refreshSources: false,
          evidenceUsed: [],
        }],
      },
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    const { rerender } = renderWithProviders(<IntelligenceChatPanel ticker="AAPL" intelligence={baseIntelligence} />);
    expect(screen.getByText('Old-revision answer')).toBeInTheDocument();

    rerender(
      <IntelligenceChatPanel
        ticker="AAPL"
        intelligence={{ ...baseIntelligence, generatedAt: '2026-07-03T09:00:00Z' }}
      />,
    );

    expect(screen.queryByText('Old-revision answer')).not.toBeInTheDocument();
    expect(intelligenceHooks.useIntelligenceChatQuery).toHaveBeenLastCalledWith(
      'AAPL',
      true,
      '2026-07-03T09:00:00Z',
    );
  });
});
