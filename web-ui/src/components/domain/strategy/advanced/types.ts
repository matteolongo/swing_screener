import type { Strategy } from '@/features/strategy/types';

export interface AdvancedSectionProps {
  draft: Strategy;
  setDraft: (value: Strategy) => void;
}
