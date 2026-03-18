import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FloatingChatWidget from '@/components/domain/workspace/FloatingChatWidget';
import { renderWithProviders } from '@/test/utils';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useScreenerStore } from '@/stores/screenerStore';

const { mutateMock } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
}));

vi.mock('@/features/chat/hooks', () => ({
  useWorkspaceChatMutation: () => ({
    mutateAsync: mutateMock,
    isPending: false,
    isError: false,
    error: null,
  }),
}));

function buildChatResponse(overrides = {}) {
  return {
    answer: 'AAPL looks good.',
    warnings: [],
    factsUsed: ['screener'],
    contextMeta: {
      selectedTicker: 'AAPL',
      sources: [
        { source: 'screener', label: 'Screener', loaded: true, origin: 'local', count: 1 },
      ],
    },
    conversationState: [
      { role: 'user' as const, content: 'Should I buy AAPL?' },
      { role: 'assistant' as const, content: 'AAPL looks good.' },
    ],
    ...overrides,
  };
}

describe('FloatingChatWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutateMock.mockResolvedValue(buildChatResponse());
    useWorkspaceStore.setState({ selectedTicker: null, selectedTickerSource: null });
    useScreenerStore.setState({ lastResult: null });
  });

  it('renders the toggle button and no chat panel initially', () => {
    renderWithProviders(<FloatingChatWidget />);

    expect(screen.getByRole('button', { name: /open workspace chat/i })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens and closes the chat panel via toggle button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FloatingChatWidget />);

    await user.click(screen.getByRole('button', { name: /open workspace chat/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Click the X close button inside the panel header (not the toggle button)
    const closeButtons = screen.getAllByRole('button', { name: /close workspace chat/i });
    await user.click(closeButtons[0]); // first is the header X button
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the selected ticker in the header when a ticker is selected', async () => {
    useWorkspaceStore.setState({ selectedTicker: 'AAPL', selectedTickerSource: 'screener' });
    const user = userEvent.setup();
    renderWithProviders(<FloatingChatWidget />);

    await user.click(screen.getByRole('button', { name: /open workspace chat/i }));

    // ticker badge in header
    expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0);
  });

  it('toggles the context accordion open and closed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FloatingChatWidget />);

    await user.click(screen.getByRole('button', { name: /open workspace chat/i }));

    const contextToggle = screen.getByRole('button', { name: /what the ai knows/i });
    expect(contextToggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(contextToggle);
    expect(contextToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/selected symbol/i)).toBeInTheDocument();

    await user.click(contextToggle);
    expect(contextToggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('submits the question and shows the response in the conversation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FloatingChatWidget />);

    await user.click(screen.getByRole('button', { name: /open workspace chat/i }));

    const textarea = screen.getByLabelText(/ask the workspace agent/i);
    await user.type(textarea, 'Should I buy AAPL?');

    await user.click(screen.getByRole('button', { name: /^ask$/i }));

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith(
        expect.objectContaining({ question: 'Should I buy AAPL?' })
      );
    });

    await waitFor(() => {
      expect(screen.getByText('AAPL looks good.')).toBeInTheDocument();
    });
  });

  it('clears the draft after a successful submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FloatingChatWidget />);

    await user.click(screen.getByRole('button', { name: /open workspace chat/i }));

    const textarea = screen.getByLabelText(/ask the workspace agent/i) as HTMLTextAreaElement;
    await user.type(textarea, 'Should I buy AAPL?');
    expect(textarea.value).toBe('Should I buy AAPL?');

    await user.click(screen.getByRole('button', { name: /^ask$/i }));
    await waitFor(() => expect(textarea.value).toBe(''));
  });

  it('does not render a warnings section when the response has no warnings', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FloatingChatWidget />);

    await user.click(screen.getByRole('button', { name: /open workspace chat/i }));
    await user.type(screen.getByLabelText(/ask the workspace agent/i), 'Any warnings?');
    await user.click(screen.getByRole('button', { name: /^ask$/i }));

    await waitFor(() => {
      expect(screen.getByText('AAPL looks good.')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /expand chat warnings/i })).not.toBeInTheDocument();
  });

  it('shows warnings collapsed by default and toggles them open and closed', async () => {
    mutateMock.mockResolvedValue(
      buildChatResponse({ warnings: ['Context may be stale.'] })
    );
    const user = userEvent.setup();
    renderWithProviders(<FloatingChatWidget />);

    await user.click(screen.getByRole('button', { name: /open workspace chat/i }));
    await user.type(screen.getByLabelText(/ask the workspace agent/i), 'Any warnings?');
    await user.click(screen.getByRole('button', { name: /^ask$/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /expand chat warnings/i })).toBeInTheDocument();
    });

    const warningsToggle = screen.getByRole('button', { name: /expand chat warnings/i });
    expect(warningsToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Caveats & warnings (1)')).toBeInTheDocument();
    expect(screen.queryByText('Context may be stale.')).not.toBeInTheDocument();

    await user.click(warningsToggle);

    expect(screen.getByRole('button', { name: /collapse chat warnings/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Context may be stale.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /collapse chat warnings/i }));

    expect(screen.getByRole('button', { name: /expand chat warnings/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Context may be stale.')).not.toBeInTheDocument();
  });
});
