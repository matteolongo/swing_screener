import { ReactNode, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

interface CollapsibleCardProps {
  id: string;
  title: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

function readOpen(id: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(`card.${id}.open`);
    return raw == null ? fallback : raw === 'true';
  } catch {
    return fallback;
  }
}

export default function CollapsibleCard({
  id,
  title,
  summary,
  defaultOpen = true,
  children,
  className,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(() => readOpen(id, defaultOpen));

  const toggle = () => {
    setOpen((current) => {
      const next = !current;
      try {
        localStorage.setItem(`card.${id}.open`, String(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  };

  return (
    <section className={cn('rounded-lg border border-border bg-surface', className)}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex h-10 w-full items-center gap-2 px-3 text-left"
      >
        <span className="text-[13px] font-medium text-foreground">{title}</span>
        {summary && <span className="flex items-center gap-1.5">{summary}</span>}
        <ChevronDown
          className={cn('ml-auto h-4 w-4 shrink-0 text-muted transition-transform', !open && '-rotate-90')}
        />
      </button>
      {open && <div className="border-t border-border p-3">{children}</div>}
    </section>
  );
}
