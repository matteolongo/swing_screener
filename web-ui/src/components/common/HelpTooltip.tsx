import { useState, ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/utils/cn';
import ModalShell from './ModalShell';

interface HelpTooltipProps {
  short: string;
  title: string;
  content: ReactNode;
  className?: string;
}

export default function HelpTooltip({ short, title, content, className }: HelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const handleClose = () => {
    setIsOpen(false);
    setShowTooltip(false);
  };

  const modal = isOpen ? (
    <ModalShell
      title={title}
      onClose={handleClose}
      className="max-w-2xl"
      contentClassName="prose prose-invert max-w-none"
    >
      {content}
    </ModalShell>
  ) : null;

  return (
    <>
      {/* Help Icon with Tooltip */}
      <div className="relative inline-block">
        <button
          type="button"
          className={cn('min-h-11 min-w-11 text-muted hover:text-primary transition-colors', className)}
          onClick={() => setIsOpen(true)}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          aria-label={short || title}
          title={title}
        >
          <HelpCircle className="w-4 h-4" />
        </button>
        
        {/* Hover Tooltip */}
        {showTooltip && !isOpen && (
          <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-sm text-foreground bg-surface rounded-md whitespace-nowrap pointer-events-none">
            {short}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-surface" />
          </div>
        )}
      </div>

      {modal}
    </>
  );
}
