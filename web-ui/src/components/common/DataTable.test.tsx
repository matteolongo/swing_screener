import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DataTable, { type DataTableColumn } from '@/components/common/DataTable';

type Row = {
  id: string;
  symbol: string;
  value: number;
};

const rows: Row[] = [
  { id: '1', symbol: 'AAPL', value: 10 },
  { id: '2', symbol: 'MSFT', value: 20 },
];

const columns: DataTableColumn<Row>[] = [
  {
    key: 'symbol',
    header: 'Symbol',
    render: (row) => row.symbol,
  },
  {
    key: 'value',
    header: 'Value',
    align: 'right',
    render: (row) => row.value.toString(),
  },
];

describe('DataTable', () => {
  it('renders headers and rows', () => {
    render(
      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(row) => row.id}
      />,
    );

    expect(screen.getByText('Symbol')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(
      <DataTable
        rows={[]}
        columns={columns}
        getRowKey={(row) => row.id}
        emptyMessage="No rows"
      />,
    );

    expect(screen.getByText('No rows')).toBeInTheDocument();
  });
});
