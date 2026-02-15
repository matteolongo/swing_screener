/**
 * ParameterWarning - Displays behavioral guidance warnings for dangerous configurations
 * Implements Layer 3 (Behavioral Guidance) from the education strategy
 */
import type { ReactNode } from 'react';

interface ParameterWarningProps {
  level: 'warning' | 'danger' | 'info';
  message: ReactNode;
}

export default function ParameterWarning({ level, message }: ParameterWarningProps) {
  const styles = {
    warning: {
      container: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700',
      icon: '⚠️',
      text: 'text-yellow-800 dark:text-yellow-200',
    },
    danger: {
      container: 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700',
      icon: '🚨',
      text: 'text-red-800 dark:text-red-200',
    },
    info: {
      container: 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700',
      icon: '💡',
      text: 'text-blue-800 dark:text-blue-200',
    },
  };

  const style = styles[level];

  return (
    <div className={`mt-2 px-3 py-2 border rounded-lg ${style.container}`}>
      <div className={`text-sm ${style.text} flex items-start gap-2`}>
        <span className="text-base flex-shrink-0">{style.icon}</span>
        <span className="flex-1">{message}</span>
      </div>
    </div>
  );
}
