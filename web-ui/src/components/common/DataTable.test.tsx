import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import DataTable, { type DataTableColumn } from '@/components/common/DataTable';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';

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
  it.each(['{Enter}', ' '])('preserves native child action activation with %s', async (key) => {
    const onRowClick = vi.fn();
    const onAction = vi.fn();
    renderWithProviders(<DataTable
      rows={[rows[0]]}
      columns={[...columns, {
        key: 'action', header: t('common.actions.save'),
        render: (row) => <button type="button" onClick={(event) => {
          event.stopPropagation();
          onAction(row);
        }}>{t('common.actions.save')}</button>,
      }]}
      getRowKey={(row) => row.id}
      onRowClick={onRowClick}
    />);
    screen.getByRole('button', { name: t('common.actions.save') }).focus();
    await userEvent.keyboard(key);
    expect(onAction).toHaveBeenCalledWith(rows[0]);
    expect(onRowClick).not.toHaveBeenCalled();
  });

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
