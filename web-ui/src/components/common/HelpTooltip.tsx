import { useState, ReactNode } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { cn } from '@/utils/cn';

interface HelpTooltipProps {
  short: string;
  title: string;
  content: ReactNode;
  className?: string;
}

export default function HelpTooltip({ short, title, content, className }: HelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <>
      {/* Help Icon with Tooltip */}
      <div className="relative inline-block">
        <button
          type="button"
          className={cn('text-gray-400 hover:text-primary transition-colors', className)}
          onClick={() => setIsOpen(true)}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <HelpCircle className="w-4 h-4" />
        </button>
        
        {/* Hover Tooltip */}
        {showTooltip && !isOpen && (
          <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-sm text-white bg-gray-900 rounded-md whitespace-nowrap pointer-events-none">
            {short}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
          </div>
        )}
      </div>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setIsOpen(false)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="text-xl font-semibold">{title}</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 prose dark:prose-invert max-w-none">
              {content}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
