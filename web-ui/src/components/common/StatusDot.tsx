import { cn } from '@/utils/cn';

export type StatusTone = 'ok' | 'warn' | 'down' | 'idle';

const TONE_CLASS: Record<StatusTone, string> = {
  ok: 'bg-success',
  warn: 'bg-warning',
  down: 'bg-danger',
  idle: 'bg-muted/50',
};

interface StatusDotProps {
  tone: StatusTone;
  pulse?: boolean;
  label?: string;
  className?: string;
}

export default function StatusDot({ tone, pulse = false, label, className }: StatusDotProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn('inline-block h-1.5 w-1.5 rounded-full', TONE_CLASS[tone], pulse && 'animate-pulse', className)}
    />
  );
}
