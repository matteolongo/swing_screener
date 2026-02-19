import type { ReactNode } from 'react';
import TableShell from '@/components/common/TableShell';

type DataTableAlign = 'left' | 'center' | 'right';

export interface DataTableColumn<RowT> {
  key: string;
  header: ReactNode;
  align?: DataTableAlign;
  headerClassName?: string;
  cellClassName?: string;
  render: (row: RowT) => ReactNode;
}

interface DataTableProps<RowT> {
  rows: RowT[];
  columns: DataTableColumn<RowT>[];
  getRowKey: (row: RowT, index: number) => string;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  error?: string;
  wrapperClassName?: string;
  tableClassName?: string;
  rowClassName?: string | ((row: RowT, index: number) => string);
  onRowClick?: (row: RowT, index: number) => void;
}

function alignClass(align: DataTableAlign | undefined): string {
  if (align === 'right') return 'text-right';
  if (align === 'center') return 'text-center';
  return 'text-left';
}

export default function DataTable<RowT>({
  rows,
  columns,
  getRowKey,
  loading = false,
  empty = rows.length === 0,
  emptyMessage,
  error,
  wrapperClassName,
  tableClassName,
  rowClassName = 'border-t',
  onRowClick,
}: DataTableProps<RowT>) {
  return (
    <TableShell
      loading={loading}
      empty={empty}
      emptyMessage={emptyMessage}
      error={error}
      wrapperClassName={wrapperClassName}
      tableClassName={tableClassName}
      headers={(
        <tr className="text-left text-xs text-gray-500">
          {columns.map((column) => (
            <th
              key={column.key}
              className={`py-2 ${alignClass(column.align)} ${column.headerClassName ?? ''}`.trim()}
            >
              {column.header}
            </th>
          ))}
        </tr>
      )}
    >
      {rows.map((row, index) => (
        <tr
          key={getRowKey(row, index)}
          className={typeof rowClassName === 'function' ? rowClassName(row, index) : rowClassName}
          onClick={onRowClick ? () => onRowClick(row, index) : undefined}
        >
          {columns.map((column) => (
            <td
              key={column.key}
              className={`py-2 ${alignClass(column.align)} ${column.cellClassName ?? ''}`.trim()}
            >
              {column.render(row)}
            </td>
          ))}
        </tr>
      ))}
    </TableShell>
  );
}
