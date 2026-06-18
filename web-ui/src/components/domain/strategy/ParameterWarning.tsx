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
      container: 'bg-warning/10 border-warning/40',
      icon: '⚠️',
      text: 'text-warning',
    },
    danger: {
      container: 'bg-danger/10 border-danger/40',
      icon: '🚨',
      text: 'text-danger',
    },
    info: {
      container: 'bg-primary/10 border-primary/40',
      icon: '💡',
      text: 'text-primary',
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
