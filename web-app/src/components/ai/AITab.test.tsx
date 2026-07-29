import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import AITab from './AITab';
import { usePortfolioStore } from '../../store/usePortfolioStore';

const mockGetSymbolPool = vi.fn();

vi.mock('../../hooks/useAIConsole', () => ({
  useAIConsole: () => ({
    selectedSymbol: 'AAPL',
    historyEntries: [
      { generated_at: '2025-07-28T20:00:00Z', action: 'ENTER', conviction: 'high', summary_line: 'Test entry', watch_for: '' },
    ],
    latestAnalysis: {
      ticker: 'AAPL',
      generated_at: '2025-07-28T20:00:00Z',
      thesis: 'Strong setup',
      entry: 180,
      stop: 170,
      target: 200,
      rr: 2.5,
    },
    chatMessages: [
      { role: 'user', content: 'Test question', ts: '2025-07-28T20:00:00Z' },
      { role: 'assistant', content: 'Test answer', ts: '2025-07-28T20:00:01Z' },
    ],
    isLoading: false,
    error: null,
    setSelectedSymbol: vi.fn(),
    sendChatMessage: vi.fn(),
    forceRefresh: vi.fn(),
  }),
}));

vi.mock('../../services/api/screenerApi', () => ({
  getSymbolPool: (...args: unknown[]) => mockGetSymbolPool(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  usePortfolioStore.setState({ positions: [], isLoading: false });
  mockGetSymbolPool.mockResolvedValue({ symbols: [{ symbol: 'AAPL', exchange_mic: 'XNAS' }], total: 1, page: 1, page_size: 50 });
});

describe('AITab', () => {
  it('renders symbol search input', () => {
    render(<AITab />);
    expect(screen.getByPlaceholderText('Search symbol...')).toBeInTheDocument();
  });

  it('renders Force Refresh button', () => {
    render(<AITab />);
    expect(screen.getByText('Force Refresh')).toBeInTheDocument();
  });

  it('renders time range buttons', () => {
    render(<AITab />);
    ['1h', '4h', '12h', '24h', 'All'].forEach((r) => {
      expect(screen.getByText(r)).toBeInTheDocument();
    });
  });

  it('renders chat messages', () => {
    render(<AITab />);
    expect(screen.getByText('Test question')).toBeInTheDocument();
    expect(screen.getByText('Test answer')).toBeInTheDocument();
  });

  it('renders analysis history', () => {
    render(<AITab />);
    expect(screen.getByText('Test entry')).toBeInTheDocument();
  });

  it('renders intelligence panel with thesis', () => {
    render(<AITab />);
    expect(screen.getByText('Strong setup')).toBeInTheDocument();
  });
});


