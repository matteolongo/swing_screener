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
}: TableShellProps) {
  if (loading || error || empty) {
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
