import { create } from 'zustand';
import type { Position, DailyReview } from '@/types/api';
import { getPositions, getDailyReview, getStopPreview } from '@/services/api/portfolioApi';

interface PortfolioState {
  positions: Position[];
  dailyReview: DailyReview | null;
  selectedPositionId: string | null;
  isLoading: boolean;

  setSelectedPositionId: (id: string | null) => void;
  fetchPositions: () => Promise<void>;
  fetchDailyReview: () => Promise<void>;
  updateStopPreview: (positionId: string, stopPrice: number) => Promise<Record<string, unknown>>;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  positions: [],
  dailyReview: null,
  selectedPositionId: null,
  isLoading: false,

  setSelectedPositionId: (id) => set({ selectedPositionId: id }),

  fetchPositions: async () => {
    try {
      set({ isLoading: true });
      const positions = await getPositions();
      set({ positions, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchDailyReview: async () => {
    try {
      set({ isLoading: true });
      const review = await getDailyReview();
      set({ dailyReview: review, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  updateStopPreview: async (positionId, stopPrice) => {
    const preview = await getStopPreview(positionId, stopPrice);
    return preview;
  },
}));
