import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAIConsole } from './useAIConsole';

const mockGetAIHistory = vi.fn();
const mockGetAILatest = vi.fn();
const mockAnalyzeTicker = vi.fn();
const mockPostChat = vi.fn();

vi.mock('../services/api/aiApi', () => ({
  getAIHistory: (...args: unknown[]) => mockGetAIHistory(...args),
  getAILatest: (...args: unknown[]) => mockGetAILatest(...args),
  analyzeTicker: (...args: unknown[]) => mockAnalyzeTicker(...args),
  postChat: (...args: unknown[]) => mockPostChat(...args),
}));

const mockHistoryResponse = {
  entries: [
    { generated_at: '2025-07-28T20:00:00Z', action: 'ENTER', conviction: 'high', summary_line: 'Strong momentum setup', watch_for: 'volume confirmation' },
    { generated_at: '2025-07-27T20:00:00Z', action: 'WATCH', conviction: 'medium', summary_line: 'Consolidation forming', watch_for: 'breakout above resistance' },
  ],
};

const mockLatestAnalysis = {
  ticker: 'AAPL',
  generated_at: '2025-07-28T20:00:00Z',
  thesis: 'Strong momentum breakout with volume confirmation',
  entry: 180,
  stop: 170,
  target: 200,
  rr: 2.5,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAIHistory.mockResolvedValue(mockHistoryResponse);
  mockGetAILatest.mockResolvedValue(mockLatestAnalysis);
  mockPostChat.mockResolvedValue({ response: 'Analysis confirms bullish pattern', evidence_used: ['trendline breakout'] });
  mockAnalyzeTicker.mockResolvedValue({ ...mockLatestAnalysis, generated_at: '2025-07-29T20:00:00Z' });
});

describe('useAIConsole', () => {
  it('starts with no symbol selected', () => {
    const { result } = renderHook(() => useAIConsole());
    expect(result.current.selectedSymbol).toBeNull();
    expect(result.current.historyEntries).toEqual([]);
    expect(result.current.latestAnalysis).toBeNull();
    expect(result.current.chatMessages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('setSelectedSymbol fetches history and latest analysis', async () => {
    mockGetAIHistory.mockImplementation(() => new Promise((r) => setTimeout(() => r(mockHistoryResponse), 50)));
    mockGetAILatest.mockImplementation(() => new Promise((r) => setTimeout(() => r(mockLatestAnalysis), 50)));
    const { result } = renderHook(() => useAIConsole());
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    result.current.setSelectedSymbol('AAPL');
    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });
    await waitFor(() => {
      expect(result.current.selectedSymbol).toBe('AAPL');
    });
    expect(result.current.isLoading).toBe(false);
    expect(mockGetAIHistory).toHaveBeenCalledWith('AAPL');
    expect(mockGetAILatest).toHaveBeenCalledWith('AAPL');
    expect(result.current.historyEntries).toHaveLength(2);
    expect(result.current.latestAnalysis?.thesis).toBe('Strong momentum breakout with volume confirmation');
  });

  it('setSelectedSymbol sets error on failure', async () => {
    mockGetAIHistory.mockImplementation(() => new Promise((_, r) => setTimeout(() => r(new Error('API error')), 10)));
    mockGetAILatest.mockImplementation(() => new Promise((_, r) => setTimeout(() => r(new Error('API error')), 10)));
    const { result } = renderHook(() => useAIConsole());
    result.current.setSelectedSymbol('AAPL');
    await waitFor(() => {
      expect(result.current.error).toBe('API error');
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('sendChatMessage appends user and assistant messages', async () => {
    mockGetAIHistory.mockImplementation(() => Promise.resolve({ entries: [] }));
    mockGetAILatest.mockImplementation(() => Promise.resolve(mockLatestAnalysis));
    const { result } = renderHook(() => useAIConsole());
    result.current.setSelectedSymbol('AAPL');
    await waitFor(() => {
      expect(result.current.selectedSymbol).toBe('AAPL');
    });
    result.current.sendChatMessage('What is the outlook?');
    await waitFor(() => {
      expect(result.current.chatMessages).toHaveLength(2);
    });
    expect(result.current.chatMessages[0].role).toBe('user');
    expect(result.current.chatMessages[0].content).toBe('What is the outlook?');
    expect(result.current.chatMessages[1].role).toBe('assistant');
    expect(result.current.chatMessages[1].content).toBe('Analysis confirms bullish pattern');
    expect(result.current.chatMessages[1].evidence_used).toEqual(['trendline breakout']);
  });

  it('sendChatMessage does nothing when no symbol selected', async () => {
    const { result } = renderHook(() => useAIConsole());
    result.current.sendChatMessage('test');
    expect(mockPostChat).not.toHaveBeenCalled();
    expect(result.current.chatMessages).toEqual([]);
  });

  it('sendChatMessage handles API error gracefully', async () => {
    mockPostChat.mockImplementation(() => Promise.reject(new Error('Chat error')));
    mockGetAIHistory.mockImplementation(() => Promise.resolve({ entries: [] }));
    mockGetAILatest.mockImplementation(() => Promise.resolve(mockLatestAnalysis));
    const { result } = renderHook(() => useAIConsole());
    result.current.setSelectedSymbol('AAPL');
    await waitFor(() => {
      expect(result.current.selectedSymbol).toBe('AAPL');
    });
    result.current.sendChatMessage('Hello');
    await waitFor(() => {
      expect(result.current.chatMessages.length).toBe(2);
    });
    expect(result.current.chatMessages[1].role).toBe('assistant');
    expect(result.current.chatMessages[1].content).toBe('Chat error');
  });

  it('forceRefresh triggers reanalysis and fetches updated data', async () => {
    mockGetAIHistory.mockImplementation(() => Promise.resolve({ entries: [] }));
    mockGetAILatest.mockImplementation(() => Promise.resolve(mockLatestAnalysis));
    const { result } = renderHook(() => useAIConsole());
    result.current.setSelectedSymbol('AAPL');
    await waitFor(() => {
      expect(result.current.selectedSymbol).toBe('AAPL');
    });
    vi.clearAllMocks();
    mockAnalyzeTicker.mockImplementation(() => Promise.resolve({ ...mockLatestAnalysis, generated_at: '2025-07-29T20:00:00Z' }));
    mockGetAIHistory.mockImplementation(() => Promise.resolve({ entries: [{ generated_at: '2025-07-29T20:00:00Z', action: 'ENTER', conviction: 'high', summary_line: 'Updated', watch_for: '' }] }));
    result.current.forceRefresh();
    await waitFor(() => {
      expect(mockAnalyzeTicker).toHaveBeenCalledWith('AAPL', true);
    });
    await waitFor(() => {
      expect(result.current.latestAnalysis?.generated_at).toBe('2025-07-29T20:00:00Z');
    });
  });

  it('forceRefresh handles error', async () => {
    mockGetAIHistory.mockImplementation(() => Promise.resolve({ entries: [] }));
    mockGetAILatest.mockImplementation(() => Promise.resolve(mockLatestAnalysis));
    const { result } = renderHook(() => useAIConsole());
    result.current.setSelectedSymbol('AAPL');
    await waitFor(() => {
      expect(result.current.selectedSymbol).toBe('AAPL');
    });
    mockAnalyzeTicker.mockRejectedValue(new Error('Refresh failed'));
    result.current.forceRefresh();
    await waitFor(() => {
      expect(result.current.error).toBe('Refresh failed');
    });
  });
});
