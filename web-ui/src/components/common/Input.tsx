import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';
import { useFieldControl } from './Field';

/** Canonical token-based class for text/number inputs and selects across the app. */
export const CONTROL_CLASS =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-foreground/5 disabled:text-muted';

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, id, ...props }, ref) {
    const field = useFieldControl();
    return <input ref={ref} id={id ?? field?.id} className={cn(CONTROL_CLASS, className)} {...props} />;
  },
);

export default Input;
