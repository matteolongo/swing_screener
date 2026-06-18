import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { usePositions } from '@/features/portfolio/hooks';
import type { Position } from '@/features/portfolio/types';
import { t } from '@/i18n/t';
import { formatCurrency, formatNumber, getSignColorClass } from '@/utils/formatters';
import { cn } from '@/utils/cn';
import RChip from '@/components/common/RChip';

function computeFinalR(position: Position): number | null {
  const initialRisk = position.initialRisk;
  if (!initialRisk || initialRisk <= 0) return null;
  if (position.exitPrice == null) return null;
  return (position.exitPrice - position.entryPrice) / initialRisk;
}

function computeMaxR(position: Position): number | null {
  const initialRisk = position.initialRisk;
  if (!initialRisk || initialRisk <= 0) return null;
  if (position.maxFavorablePrice == null) return null;
  return (position.maxFavorablePrice - position.entryPrice) / initialRisk;
}

function RBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted">—</span>;
  return <RChip value={value} />;
}

function getTagLabel(tag: string): string {
  const labels: Record<string, string> = {
    breakout: t('tradeTags.breakout'),
    pullback: t('tradeTags.pullback'),
    add_on: t('tradeTags.addOn'),
    stop_hit: t('tradeTags.stopHit'),
    target_reached: t('tradeTags.targetReached'),
    time_stop: t('tradeTags.timeStop'),
    manual_exit: t('tradeTags.manualExit'),
    trending: t('tradeTags.trending'),
    choppy: t('tradeTags.choppy'),
    news_driven: t('tradeTags.newsDriven'),
  };
  return labels[tag] ?? tag;
}

interface JournalRowProps {
  position: Position;
}

function JournalRow({ position }: JournalRowProps) {
  const [expanded, setExpanded] = useState(false);
  const finalR = computeFinalR(position);
  const maxR = computeMaxR(position);

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-foreground/5 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-3 text-sm text-muted whitespace-nowrap">
          {expanded ? <ChevronDown className="inline h-4 w-4" /> : <ChevronRight className="inline h-4 w-4" />}
          <span className="ml-1">{position.exitDate ?? '—'}</span>
        </td>
        <td className="px-4 py-3 text-sm font-semibold text-foreground">{position.ticker}</td>
        <td className="px-4 py-3 text-sm text-right tabular-nums">{formatCurrency(position.entryPrice)}</td>
        <td className="px-4 py-3 text-sm text-right tabular-nums">
          {position.exitPrice != null ? formatCurrency(position.exitPrice) : '—'}
        </td>
        <td className="px-4 py-3 text-sm text-right tabular-nums">{position.shares}</td>
        <td className="px-4 py-3 text-sm">
          {(position.tags ?? []).length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {(position.tags ?? []).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border bg-foreground/5 px-2 py-0.5 text-xs font-medium text-muted"
                >
                  {getTagLabel(tag)}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-muted">{t('common.placeholders.emDash')}</span>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-right tabular-nums">
          {position.initialRisk != null ? formatCurrency(position.initialRisk) : '—'}
        </td>
        <td className="px-4 py-3 text-sm text-right tabular-nums"><RBadge value={finalR} /></td>
        <td className="px-4 py-3 text-sm text-right tabular-nums"><RBadge value={maxR} /></td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={9} className="px-4 pb-4 pt-0 bg-foreground/5">
            <div className="grid gap-4 sm:grid-cols-3 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">
                  {t('journalPage.labels.thesis')}
                </p>
                <p className="text-foreground whitespace-pre-wrap">
                  {position.thesis || t('journalPage.labels.noEntry')}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">
                  {t('journalPage.labels.notes')}
                </p>
                <pre className="whitespace-pre-wrap font-sans text-foreground">
                  {position.notes || t('journalPage.labels.noEntry')}
                </pre>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">
                  {t('journalPage.labels.lesson')}
                </p>
                <p className="text-foreground whitespace-pre-wrap">
                  {position.lesson || t('journalPage.labels.noEntry')}
                </p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function Journal() {
  const { data, isLoading, isError } = usePositions('closed');
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);

  const positions = (data ?? []).slice().sort((a, b) => {
    const da = a.exitDate ?? '';
    const db = b.exitDate ?? '';
    return db.localeCompare(da);
  });

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    positions.forEach((position) => (position.tags ?? []).forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [positions]);

  const filteredPositions = useMemo(
    () => activeTagFilter
      ? positions.filter((position) => (position.tags ?? []).includes(activeTagFilter))
      : positions,
    [activeTagFilter, positions],
  );

  const totalTrades = filteredPositions.length;
  const wins = filteredPositions.filter((p) => (computeFinalR(p) ?? 0) > 0).length;
  const losses = filteredPositions.filter((p) => (computeFinalR(p) ?? 0) < 0).length;
  const finalRValues = filteredPositions.map(computeFinalR).filter((r): r is number => r !== null);
  const maxRValues = filteredPositions.map(computeMaxR).filter((r): r is number => r !== null);
  const avgFinalR = finalRValues.length > 0 ? finalRValues.reduce((a, b) => a + b, 0) / finalRValues.length : null;
  const avgMaxR = maxRValues.length > 0 ? maxRValues.reduce((a, b) => a + b, 0) / maxRValues.length : null;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t('journalPage.title')}</h1>
        <p className="text-sm text-muted mt-1">{t('journalPage.subtitle')}</p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 mb-6">
        {[
          { label: t('journalPage.stats.totalTrades'), value: String(totalTrades) },
          { label: t('journalPage.stats.wins'), value: String(wins), positive: true },
          { label: t('journalPage.stats.losses'), value: String(losses), negative: true },
          { label: t('journalPage.stats.avgFinalR'), value: avgFinalR != null ? `${avgFinalR > 0 ? '+' : ''}${formatNumber(avgFinalR, 2)}R` : '—', rValue: avgFinalR },
          { label: t('journalPage.stats.avgMaxR'), value: avgMaxR != null ? `${formatNumber(avgMaxR, 2)}R` : '—', rValue: avgMaxR },
        ].map(({ label, value, positive, negative, rValue }) => (
          <div key={label} className="rounded-lg border border-border bg-surface p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
            <p className={cn(
              'mt-1 text-lg font-bold',
              positive ? 'text-success' :
              negative ? 'text-danger' :
              rValue != null ? getSignColorClass(rValue) :
              'text-foreground'
            )}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {isLoading && (
        <p className="text-sm text-muted">{t('common.table.loading')}</p>
      )}

      {isError && (
        <p className="text-sm text-danger">{t('common.errors.generic')}</p>
      )}

      {!isLoading && !isError && positions.length === 0 && (
        <p className="text-sm text-muted">{t('journalPage.empty')}</p>
      )}

      {!isLoading && !isError && positions.length > 0 && (
        <>
          {allTags.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {allTags.map((tag) => {
                const active = activeTagFilter === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setActiveTagFilter(active ? null : tag)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      active
                        ? 'border-primary/40 bg-primary text-white'
                        : 'border-border bg-surface text-muted hover:border-primary/40',
                    )}
                  >
                    {getTagLabel(tag)}
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-foreground/5">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    {t('journalPage.columns.date')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    {t('journalPage.columns.ticker')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted">
                    {t('journalPage.columns.entry')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted">
                    {t('journalPage.columns.exit')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted">
                    {t('journalPage.columns.shares')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    {t('journalPage.columns.tags')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted">
                    {t('journalPage.columns.initialRisk')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted">
                    {t('journalPage.columns.finalR')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted">
                    {t('journalPage.columns.maxR')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPositions.map((position) => (
                  <JournalRow key={position.positionId ?? `${position.ticker}-${position.exitDate}`} position={position} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
