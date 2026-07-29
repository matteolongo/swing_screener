import { create } from 'zustand';
import type { AIAnalysis, OrderDraft } from '../types/api';
import { analyzeTicker } from '../services/api/aiApi';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  evidence_used?: string[];
  ts: string;
}

interface AIState {
  analysisData: Record<string, AIAnalysis>;
  activeSymbol: string | null;
  chatHistory: Record<string, ChatMessage[]>;
  drafts: Record<string, OrderDraft>;

  setActiveSymbol: (symbol: string | null) => void;
  setAnalysis: (ticker: string, analysis: AIAnalysis) => void;
  fetchAnalysis: (ticker: string) => Promise<void>;
  addChatMessage: (ticker: string, msg: ChatMessage) => void;
  setDraft: (ticker: string, draft: OrderDraft) => void;
}

export const useAIStore = create<AIState>((set) => ({
  analysisData: {},
  activeSymbol: null,
  chatHistory: {},
  drafts: {},

  setActiveSymbol: (symbol) => set({ activeSymbol: symbol }),

  setAnalysis: (ticker, analysis) =>
    set((s) => ({ analysisData: { ...s.analysisData, [ticker]: analysis } })),

  fetchAnalysis: async (ticker) => {
    try {
      const analysis = await analyzeTicker(ticker);
      set((s) => ({ analysisData: { ...s.analysisData, [ticker]: analysis } }));
    } catch {
      // Silently handle — caller can read error from api layer
    }
  },

  addChatMessage: (ticker, msg) =>
    set((s) => ({
      chatHistory: {
        ...s.chatHistory,
        [ticker]: [...(s.chatHistory[ticker] || []), msg],
      },
    })),

  setDraft: (ticker, draft) =>
    set((s) => ({ drafts: { ...s.drafts, [ticker]: draft } })),
}));

export type { ChatMessage };
