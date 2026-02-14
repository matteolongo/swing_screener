import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';
import Button from '@/components/common/Button';
import { t } from '@/i18n/t';

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
}: ModalShellProps) {
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

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={closeOnBackdrop ? onClose : undefined}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'w-full max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl dark:bg-gray-800',
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
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
        <div className={cn('p-6', contentClassName)}>{children}</div>
      </div>
    </div>
  );
}
