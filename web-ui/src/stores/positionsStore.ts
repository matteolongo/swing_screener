import { create } from 'zustand';
import { Position } from '@/types/position';

interface PositionsStore {
  positions: Position[];
  isLoading: boolean;
  error: string | null;
  
  setPositions: (positions: Position[]) => void;
  addPosition: (position: Position) => void;
  updatePosition: (ticker: string, updates: Partial<Position>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const usePositionsStore = create<PositionsStore>((set) => ({
  positions: [],
  isLoading: false,
  error: null,
  
  setPositions: (positions) => set({ positions }),
  
  addPosition: (position) =>
    set((state) => ({
      positions: [...state.positions, position],
    })),
  
  updatePosition: (ticker, updates) =>
    set((state) => ({
      positions: state.positions.map((p) =>
        p.ticker === ticker ? { ...p, ...updates } : p
      ),
    })),
  
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));
