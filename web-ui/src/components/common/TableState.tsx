import { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { t } from '@/i18n/t';

interface TableStateProps {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  loadingMessage?: ReactNode;
  emptyMessage?: ReactNode;
}

export default function TableState({
  loading = false,
  error = null,
  empty = false,
  loadingMessage,
  emptyMessage,
}: TableStateProps) {
  if (loading) {
    return (
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {loadingMessage ?? t('tableState.loadingFallback')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
        <AlertCircle className="w-4 h-4 mt-0.5" />
        <span>
          {t('tableState.errorPrefix')}: {error}
        </span>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {emptyMessage ?? t('tableState.emptyFallback')}
      </div>
    );
  }

  return null;
}
