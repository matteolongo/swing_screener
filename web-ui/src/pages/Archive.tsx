import { Section } from '@/components/ui/Section';
import { usePortfolio } from '@/features/portfolio/usePortfolio';
import { DataTable, type ColumnDef } from '@/components/ui/DataTable';
import { formatCurrency } from '@/utils/formatters';
import { t } from '@/i18n/t';

type ArchiveRow = {
  ticker: string;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
};

export default function Archive() {
  const { positions, isLoading, isError, error } = usePortfolio();

  const rows: ArchiveRow[] = positions.map((position) => ({
    ticker: position.ticker,
    entryPrice: position.entryPrice,
    currentPrice: position.currentPrice ?? position.exitPrice ?? position.entryPrice,
    pnl: position.pnl,
  }));

  const columns: ColumnDef<ArchiveRow>[] = [
    {
      key: 'ticker',
      header: t('archivePage.columns.ticker'),
      renderCell: (row) => <span className="font-mono font-semibold">{row.ticker}</span>,
    },
    {
      key: 'entry',
      header: t('archivePage.columns.entry'),
      renderCell: (row) => formatCurrency(row.entryPrice),
    },
    {
      key: 'current',
      header: t('archivePage.columns.current'),
      renderCell: (row) => formatCurrency(row.currentPrice),
    },
    {
      key: 'pnl',
      header: t('archivePage.columns.pnl'),
      renderCell: (row) => {
        const isPositive = row.pnl >= 0;
        return (
          <span className={isPositive ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
            {isPositive ? '+' : ''}
            {formatCurrency(row.pnl)}
          </span>
        );
      },
    },
  ];

  return (
    <Section
      title={t('archivePage.title')}
      description={t('archivePage.subtitle')}
      className="mx-auto max-w-5xl"
    >
      {isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">
          {error ?? t('archivePage.loadError')}
        </div>
      ) : null}
      <DataTable
        data={isLoading ? [] : rows}
        columns={columns}
        emptyState={isLoading ? t('common.table.loading') : t('archivePage.empty')}
        className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/40"
      />
    </Section>
  );
}
