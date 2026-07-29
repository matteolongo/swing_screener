import { describe, it, expect, beforeEach } from 'vitest';
import { useAIStore } from './useAIStore';
import type { AIAnalysis } from '../types/api';

const mockAnalysis: AIAnalysis = {
  ticker: 'AAPL',
  generated_at: '2025-01-15T20:00:00Z',
  thesis: 'Strong momentum',
  entry: 180,
  stop: 170,
  target: 200,
  rr: 2.5,
};

beforeEach(() => {
  useAIStore.setState({ analysisData: {}, activeSymbol: null, chatHistory: {} });
});

describe('useAIStore', () => {
  it('sets active symbol', () => {
    useAIStore.getState().setActiveSymbol('AAPL');
    expect(useAIStore.getState().activeSymbol).toBe('AAPL');
  });

  it('clears active symbol', () => {
    useAIStore.getState().setActiveSymbol('AAPL');
    useAIStore.getState().setActiveSymbol(null);
    expect(useAIStore.getState().activeSymbol).toBeNull();
  });

  it('sets analysis for ticker', () => {
    useAIStore.getState().setAnalysis('AAPL', mockAnalysis);
    expect(useAIStore.getState().analysisData['AAPL']?.thesis).toBe('Strong momentum');
  });

  it('adds chat message for ticker', () => {
    const msg = {
      role: 'user' as const,
      content: 'What catalysts?',
      ts: '2025-01-15T20:00:00Z',
    };
    useAIStore.getState().addChatMessage('AAPL', msg);
    expect(useAIStore.getState().chatHistory['AAPL']).toHaveLength(1);
    expect(useAIStore.getState().chatHistory['AAPL'][0].content).toBe('What catalysts?');
  });

  it('appends chat messages for same ticker', () => {
    const msg1 = { role: 'user' as const, content: 'Question', ts: 't1' };
    const msg2 = { role: 'assistant' as const, content: 'Answer', ts: 't2' };
    useAIStore.getState().addChatMessage('AAPL', msg1);
    useAIStore.getState().addChatMessage('AAPL', msg2);
    expect(useAIStore.getState().chatHistory['AAPL']).toHaveLength(2);
  });
});
