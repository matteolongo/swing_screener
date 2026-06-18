import type { Strategy } from '@/features/strategy/types';
import type { HelpInfo } from '@/components/domain/strategy/StrategyFieldControls';

export interface AdvancedSectionProps {
  draft: Strategy;
  setDraft: (value: Strategy) => void;
  help: Record<string, HelpInfo>;
}
