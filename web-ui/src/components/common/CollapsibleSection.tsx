import { type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';

interface CollapsibleSectionProps {
  title: ReactNode;
  /** Optional muted text shown next to the title (e.g. a field count). */
  meta?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}

export default function CollapsibleSection({
  title,
  meta,
  defaultOpen = false,
  className,
  children,
}: CollapsibleSectionProps) {
  return (
    <details open={defaultOpen} className={cn('group rounded-lg border border-border bg-surface', className)}>
      <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-3 text-sm font-semibold text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted transition-transform group-open:rotate-90" />
        <span>{title}</span>
        {meta != null && <span className="ml-auto text-xs font-normal text-muted">{meta}</span>}
      </summary>
      <div className="border-t border-border px-4 py-4">{children}</div>
    </details>
  );
}
