import { cn } from '@/utils/cn';

interface SymbolRailRowProps {
  ticker: string;
  status: string;
  context?: string | null;
  selected?: boolean;
  onSelect: (ticker: string) => void;
}

export default function SymbolRailRow({
  ticker,
  status,
  context = null,
  selected = false,
  onSelect,
}: SymbolRailRowProps) {
  return (
    <button
      type="button"
      data-ticker={ticker.trim().toUpperCase()}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(ticker)}
      className={cn(
        'w-full rounded-md border px-3 py-2 text-left transition-colors',
        selected
          ? 'border-primary/50 bg-primary/10'
          : 'border-border bg-surface hover:bg-foreground/5',
      )}
    >
      <span className="block font-semibold text-foreground">{ticker}</span>
      <span className="mt-0.5 block text-xs font-medium text-muted">{status}</span>
      {context ? <span className="mt-0.5 block truncate text-[11px] text-muted">{context}</span> : null}
    </button>
  );
}
