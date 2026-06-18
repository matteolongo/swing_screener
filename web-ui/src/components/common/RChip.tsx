import { cn } from '@/utils/cn';
import { formatR, getSignColorClass } from '@/utils/formatters';

interface RChipProps {
  value: number;
  className?: string;
}

/**
 * The single R-multiple readout. Renders a signed R value in the tabular mono
 * style, sign-colored via the design tokens. Replaces the hand-duplicated
 * green/red ternary scattered across portfolio, positions and page components.
 */
export default function RChip({ value, className }: RChipProps) {
  return (
    <span className={cn('tabular-nums font-semibold', getSignColorClass(value), className)}>
      {formatR(value)}
    </span>
  );
}
