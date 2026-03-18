import { ReactNode, useEffect } from 'react';
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
        role="dialog"
        aria-modal="true"
        className={cn(
          'w-full bg-white shadow-xl dark:bg-gray-800',
          fullScreen
            ? 'h-dvh max-h-dvh overflow-hidden rounded-none flex flex-col'
            : 'max-h-[90vh] overflow-y-auto rounded-lg',
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={cn(
            'flex items-center justify-between border-b border-border px-6 py-4',
            immersive ? 'shrink-0 bg-white/95 dark:bg-gray-800/95' : null,
          )}
        >
          <h2 className="text-2xl font-bold">{title}</h2>
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
