import { ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  widthClassName?: string;
}

let scrollLocks = 0;

export default function Drawer({ open, onClose, title, children, widthClassName = 'w-[560px]' }: DrawerProps) {
  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    asideRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    scrollLocks += 1;
    if (scrollLocks === 1) {
      document.body.classList.add('overflow-hidden');
    }
    return () => {
      scrollLocks -= 1;
      if (scrollLocks === 0) {
        document.body.classList.remove('overflow-hidden');
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (dialogs[dialogs.length - 1] !== asideRef.current) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-background/60" onClick={onClose} aria-hidden="true" />
      <aside
        ref={asideRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          'relative flex h-full max-w-[90vw] flex-col border-l border-border bg-surface shadow-xl',
          widthClassName
        )}
      >
        <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
          <div className="min-w-0 flex-1">{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-foreground/5 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>,
    document.body
  );
}
