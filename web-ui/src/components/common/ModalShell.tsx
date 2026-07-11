import { ReactNode, useEffect, useId, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';
import Button from '@/components/common/Button';
import { t } from '@/i18n/t';

let activeScrollLocks = 0;
let previousDocumentStyles:
  | {
      bodyOverflow: string;
      htmlOverflow: string;
      bodyOverscrollBehavior: string;
      htmlOverscrollBehavior: string;
    }
  | null = null;

function acquireScrollLock() {
  if (typeof document === 'undefined') {
    return;
  }

  if (activeScrollLocks === 0) {
    previousDocumentStyles = {
      bodyOverflow: document.body.style.overflow,
      htmlOverflow: document.documentElement.style.overflow,
      bodyOverscrollBehavior: document.body.style.overscrollBehavior,
      htmlOverscrollBehavior: document.documentElement.style.overscrollBehavior,
    };

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'contain';
    document.documentElement.style.overscrollBehavior = 'contain';
  }

  activeScrollLocks += 1;
}

function releaseScrollLock() {
  if (typeof document === 'undefined' || activeScrollLocks === 0) {
    return;
  }

  activeScrollLocks -= 1;
  if (activeScrollLocks > 0 || !previousDocumentStyles) {
    return;
  }

  document.body.style.overflow = previousDocumentStyles.bodyOverflow;
  document.documentElement.style.overflow = previousDocumentStyles.htmlOverflow;
  document.body.style.overscrollBehavior = previousDocumentStyles.bodyOverscrollBehavior;
  document.documentElement.style.overscrollBehavior = previousDocumentStyles.htmlOverscrollBehavior;
  previousDocumentStyles = null;
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface ModalShellProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  closeAriaLabel?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  headerActions?: ReactNode;
  lockScroll?: boolean;
  fullScreen?: boolean;
}

export default function ModalShell({
  title,
  onClose,
  children,
  className,
  contentClassName,
  closeAriaLabel = t('modal.closeAria'),
  closeOnBackdrop = true,
  closeOnEscape = true,
  headerActions,
  lockScroll = true,
  fullScreen = false,
}: ModalShellProps) {
  const immersive = fullScreen;
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!closeOnEscape) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [closeOnEscape, onClose]);

  useEffect(() => {
    if (!lockScroll) return;
    acquireScrollLock();
    return () => releaseScrollLock();
  }, [lockScroll]);

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const firstFocusable = dialog.querySelector<HTMLElement>(focusableSelector);
    (firstFocusable ?? dialog).focus();

    return () => {
      previouslyFocusedRef.current?.focus();
    };
  }, []);

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
      .filter((element) => element.offsetParent !== null || element === document.activeElement);
    if (focusable.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex justify-center bg-black/55',
        fullScreen ? 'items-stretch' : 'items-center p-4',
      )}
      onClick={closeOnBackdrop ? onClose : undefined}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'w-full bg-surface shadow-xl',
          fullScreen
            ? 'h-dvh max-h-dvh overflow-hidden rounded-none flex flex-col'
            : 'max-h-[90vh] overflow-y-auto rounded-lg',
          className,
        )}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
      >
        <div
          className={cn(
            'flex items-center justify-between border-b border-border px-6 py-4',
            immersive ? 'shrink-0 bg-surface/95' : null,
          )}
        >
          <h2 id={titleId} className="text-2xl font-bold">{title}</h2>
          <div className="flex items-center gap-2">
            {headerActions}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              aria-label={closeAriaLabel}
              title={t('common.actions.close')}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div
          className={cn(
            immersive ? 'min-h-0 flex-1 overflow-y-auto p-6' : 'p-6',
            contentClassName,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
