import { useMemo, useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import ConcentrationBar from '@/components/domain/portfolio/ConcentrationBar';
import PortfolioRiskSummary from '@/components/domain/portfolio/PortfolioRiskSummary';
import PortfolioPanel from '@/components/domain/workspace/PortfolioPanel';
import RChip from '@/components/common/RChip';
import { usePortfolioSummary, usePositions } from '@/features/portfolio/hooks';
import type { Position } from '@/features/portfolio/types';
import { useActiveStrategyQuery } from '@/features/strategy/hooks';
import { useWeeklyReviews } from '@/features/weeklyReview/hooks';
import { cn } from '@/utils/cn';
import { formatCurrency, formatNumber, getSignColorClass } from '@/utils/formatters';
import { t } from '@/i18n/t';
import AnalyticsPage from './Analytics';
import WeeklyReviewForm, { getCurrentWeekId } from '@/components/domain/weeklyReview/WeeklyReviewForm';
import type { WeeklyReview } from '@/features/weeklyReview/api';
import PendingOrdersTab from '@/components/domain/orders/PendingOrdersTab';

// ─── Journal helpers ──────────────────────────────────────────────────────────

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

// ─── Journal tab ──────────────────────────────────────────────────────────────

function JournalTab() {
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

// ─── Positions tab ────────────────────────────────────────────────────────────

function PositionsTab() {
  const openPositionsQuery = usePositions('open');
  const activeStrategyQuery = useActiveStrategyQuery();
  const portfolioSummaryQuery = usePortfolioSummary();
  const openPositions = openPositionsQuery.data ?? [];
  const accountSize = portfolioSummaryQuery.data?.effectiveAccountSize ?? activeStrategyQuery.data?.risk?.accountSize;
  const realizedPnl = portfolioSummaryQuery.data?.realizedPnl;

  return (
    <div className="space-y-4">
      <PortfolioRiskSummary openPositions={openPositions} accountSize={accountSize} realizedPnl={realizedPnl} />
      <ConcentrationBar groups={portfolioSummaryQuery.data?.concentration ?? []} />
      <PortfolioPanel />
    </div>
  );
}

// ─── Weekly review tab ────────────────────────────────────────────────────────

function PastReviews({ reviews }: { reviews: WeeklyReview[] }) {
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const currentWeekId = getCurrentWeekId();
  const pastReviews = reviews.filter((r) => r.week_id !== currentWeekId);

  if (pastReviews.length === 0) {
    return <p className="text-sm text-muted mt-2">No past weekly reviews yet.</p>;
  }

  return (
    <div className="mt-4 space-y-2">
      <h3 className="text-sm font-semibold text-muted">Past Reviews</h3>
      {pastReviews.map((review) => (
        <div key={review.week_id} className="rounded-lg border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setExpandedWeek(expandedWeek === review.week_id ? null : review.week_id)}
            className="w-full px-3 py-2 flex items-center justify-between bg-foreground/5 text-sm font-medium text-muted hover:bg-foreground/5 text-left"
          >
            <span>Week {review.week_id}</span>
            <span className="text-muted">{expandedWeek === review.week_id ? '▲' : '▼'}</span>
          </button>
          {expandedWeek === review.week_id && (
            <div className="px-3 py-2 space-y-2 text-sm text-muted">
              {review.what_worked && (
                <div>
                  <span className="font-medium text-xs text-muted uppercase tracking-wide">What Worked</span>
                  <p className="mt-0.5">{review.what_worked}</p>
                </div>
              )}
              {review.what_didnt && (
                <div>
                  <span className="font-medium text-xs text-muted uppercase tracking-wide">What Didn't Work</span>
                  <p className="mt-0.5">{review.what_didnt}</p>
                </div>
              )}
              {review.rules_violated && (
                <div>
                  <span className="font-medium text-xs text-muted uppercase tracking-wide">Rules Violated</span>
                  <p className="mt-0.5">{review.rules_violated}</p>
                </div>
              )}
              {review.next_week_focus && (
                <div>
                  <span className="font-medium text-xs text-muted uppercase tracking-wide">Next Week Focus</span>
                  <p className="mt-0.5">{review.next_week_focus}</p>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function WeeklyReviewTab() {
  const reviewsQuery = useWeeklyReviews();

  return (
    <div className="space-y-4">
      <WeeklyReviewForm weekId={getCurrentWeekId()} />
      {reviewsQuery.data ? (
        <PastReviews reviews={reviewsQuery.data} />
      ) : null}
    </div>
  );
}

// ─── Book page ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'book.activeTab';
type BookTab = 'positions' | 'orders' | 'journal' | 'performance' | 'review';

export default function Book() {
  const [activeTab, setActiveTab] = useState<BookTab>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'positions' || stored === 'orders' || stored === 'journal' || stored === 'performance' || stored === 'review') {
      return stored;
    }
    return 'positions';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, activeTab);
  }, [activeTab]);

  const tabs: { key: BookTab; label: string }[] = [
    { key: 'positions', label: t('bookPage.tabs.positions') },
    { key: 'orders', label: t('bookPage.tabs.orders') },
    { key: 'journal', label: t('bookPage.tabs.journal') },
    { key: 'performance', label: t('bookPage.tabs.performance') },
    { key: 'review', label: t('bookPage.tabs.review') },
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-4">
      {/* Page header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">
          {t('bookPage.title')}
        </h1>
        <p className="text-sm text-muted mt-1">
          {t('bookPage.subtitle')}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 mb-6">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium transition-colors',
              activeTab === key
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted hover:text-muted'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'positions' && <PositionsTab />}
        {activeTab === 'orders' && <PendingOrdersTab />}
        {activeTab === 'journal' && <JournalTab />}
        {activeTab === 'performance' && <AnalyticsPage />}
        {activeTab === 'review' && <WeeklyReviewTab />}
      </div>
    </div>
  );
}
