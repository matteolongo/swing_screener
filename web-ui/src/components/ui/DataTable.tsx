import React from 'react';
import { t } from '@/i18n/t';

export interface ColumnDef<T> {
  key: string;
  header: React.ReactNode;
  width?: string;
  renderCell: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  emptyState?: React.ReactNode;
  className?: string;
}

export function DataTable<T>({ data, columns, emptyState, className }: DataTableProps<T>) {
  if (!data.length) {
    return (
      <div className="py-8 text-center text-gray-500">
        {emptyState ?? t('common.table.empty')}
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${className ?? ''}`}>
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200 text-left text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-2 font-medium"
                style={{ width: col.width }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="text-sm">
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-b border-gray-200 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-2 align-top">
                  {col.renderCell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
