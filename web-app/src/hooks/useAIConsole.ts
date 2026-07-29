import { useState, useCallback } from 'react';
import type { AIAnalysis, HistoryEntry } from '@/types/api';
import type { ChatMessage as AIChatMessage } from '@/store/useAIStore';
import { analyzeTicker, getAIHistory, getAILatest, postChat } from '@/services/api/aiApi';

export function useAIConsole() {
  const [selectedSymbol, setSelectedSymbolState] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [latestAnalysis, setLatestAnalysis] = useState<AIAnalysis | null>(null);
  const [chatMessages, setChatMessages] = useState<AIChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setSelectedSymbol = useCallback(async (symbol: string) => {
    setSelectedSymbolState(symbol);
    setIsLoading(true);
    setError(null);
    try {
      const [history, latest] = await Promise.all([
        getAIHistory(symbol),
        getAILatest(symbol),
      ]);
      setHistoryEntries(history.entries);
      setLatestAnalysis(latest);
      setChatMessages([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analysis');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendChatMessage = useCallback(async (message: string) => {
    if (!selectedSymbol) return;
    const userMsg: AIChatMessage = {
      role: 'user',
      content: message,
      ts: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    try {
      const response = await postChat(selectedSymbol, message) as { response: string; evidence_used?: string[] };
      const assistantMsg: AIChatMessage = {
        role: 'assistant',
        content: response.response || JSON.stringify(response),
        evidence_used: response.evidence_used,
        ts: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      const errorMsg: AIChatMessage = {
        role: 'assistant',
        content: e instanceof Error ? e.message : 'Failed to send message',
        ts: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    }
  }, [selectedSymbol]);

  const forceRefresh = useCallback(async () => {
    if (!selectedSymbol) return;
    setIsLoading(true);
    setError(null);
    try {
      const analysis = await analyzeTicker(selectedSymbol, true);
      setLatestAnalysis(analysis);
      const history = await getAIHistory(selectedSymbol);
      setHistoryEntries(history.entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh');
    } finally {
      setIsLoading(false);
    }
  }, [selectedSymbol]);

  return {
    selectedSymbol,
    historyEntries,
    latestAnalysis,
    chatMessages,
    isLoading,
    error,
    setSelectedSymbol,
    sendChatMessage,
    forceRefresh,
    setError,
  };
}
