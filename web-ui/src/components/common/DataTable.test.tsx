import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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

  it('activates clickable rows with Enter and Space', async () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(row) => row.id}
        onRowClick={onRowClick}
      />,
    );

    const firstRow = screen.getByRole('button', { name: /AAPL 10/ });
    firstRow.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');

    expect(onRowClick).toHaveBeenCalledTimes(2);
    expect(onRowClick).toHaveBeenCalledWith(rows[0], 0);
  });
});
