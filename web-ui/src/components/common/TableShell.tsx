import { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import TableState from '@/components/common/TableState';

interface TableShellProps {
  headers: ReactNode;
  children: ReactNode;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  loadingMessage?: ReactNode;
  emptyMessage?: ReactNode;
  wrapperClassName?: string;
  tableClassName?: string;
  /** Number of columns for colspan in empty/loading/error states */
  colSpan?: number;
}

export default function TableShell({
  headers,
  children,
  loading = false,
  error = null,
  empty = false,
  loadingMessage,
  emptyMessage,
  wrapperClassName,
  tableClassName,
  colSpan,
}: TableShellProps) {
  if (loading || error || empty) {
    // If colSpan is provided, render table with headers and state row
    if (colSpan) {
      return (
        <div className={cn('overflow-x-auto', wrapperClassName)}>
          <table className={cn('w-full', tableClassName)}>
            <thead>{headers}</thead>
            <tbody>
              <tr>
                <td colSpan={colSpan} className="py-8 px-4 text-center">
                  <TableState
                    loading={loading}
                    error={error}
                    empty={empty}
                    loadingMessage={loadingMessage}
                    emptyMessage={emptyMessage}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }
    
    // Fallback to old behavior if colSpan not provided (for backwards compat)
    return (
      <TableState
        loading={loading}
        error={error}
        empty={empty}
        loadingMessage={loadingMessage}
        emptyMessage={emptyMessage}
      />
    );
  }

  return (
    <div className={cn('overflow-x-auto', wrapperClassName)}>
      <table className={cn('w-full', tableClassName)}>
        <thead>{headers}</thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
