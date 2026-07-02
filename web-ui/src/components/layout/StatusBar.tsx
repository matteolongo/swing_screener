import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import Badge from '@/components/common/Badge';
import ReviewQueueDrawer from '@/components/domain/pool/ReviewQueueDrawer';
import { usePortfolioSummary } from '@/features/portfolio/hooks';
import { useReviewQueue } from '@/features/pool/hooks';
import { useActiveStrategyQuery } from '@/features/strategy/hooks';
import { useScreenerStore } from '@/stores/screenerStore';
import { freshnessBadge } from '@/lib/badgeMap';
import { formatCurrency, getSignColorClass } from '@/utils/formatters';
import { cn } from '@/utils/cn';

interface StatusBarProps {
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

function BrandMark() {
  return (
    <div className="flex items-center justify-center w-5 h-5 rounded bg-primary shrink-0">
      <svg width="10" height="10" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <polyline
          points="1,11 4.5,6.5 8,8.5 13,3"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export default function StatusBar({ isSidebarCollapsed = false, onToggleSidebar }: StatusBarProps) {
  const now = new Date();
  const { locale, t } = useI18n();
  const [reviewOpen, setReviewOpen] = useState(false);
  const reviewQueueQuery = useReviewQueue();
  const reviewCount = reviewQueueQuery.data?.length ?? 0;

  const activeStrategyQuery = useActiveStrategyQuery();
  const portfolioSummaryQuery = usePortfolioSummary();
  const lastResult = useScreenerStore((state) => state.lastResult);

  const strategy = activeStrategyQuery.data;
  const summary = portfolioSummaryQuery.data;

  const accountSize = summary?.effectiveAccountSize;
  const realizedPnl = summary?.realizedPnl;
  const riskAccountSize = accountSize ?? strategy?.risk?.accountSize ?? null;
  const riskPct = strategy?.risk?.riskPct ?? null;
  const capitalAtRisk = riskAccountSize != null && riskPct != null ? riskAccountSize * riskPct : null;

  const equityLabel = accountSize != null ? formatCurrency(accountSize) : '—';
  const pnlLabel = realizedPnl != null ? `${realizedPnl >= 0 ? '+' : ''}${formatCurrency(realizedPnl)}` : '—';
  const riskLabel = capitalAtRisk != null ? formatCurrency(capitalAtRisk) : '—';

  const dateStr = now.toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const freshnessSpec = lastResult ? freshnessBadge(lastResult.dataFreshness) : null;

  return (
    <header className="h-11 px-3 border-b border-border bg-surface flex items-center gap-3 shrink-0">
      {/* Left: toggle + collapsed brand */}
      <div className="flex items-center gap-2 shrink-0">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className={cn(
              'flex items-center justify-center w-7 h-7 rounded transition-colors',
              'text-muted hover:text-foreground hover:bg-foreground/5'
            )}
            title={isSidebarCollapsed ? t('header.showNavigation') : t('header.hideNavigation')}
            aria-label={isSidebarCollapsed ? t('header.showNavigation') : t('header.hideNavigation')}
          >
            {isSidebarCollapsed
              ? <PanelLeft className="w-4 h-4" />
              : <PanelLeftClose className="w-4 h-4" />}
          </button>
        )}
        {isSidebarCollapsed && (
          <div className="flex items-center gap-2">
            <BrandMark />
            <span className="text-[13px] font-semibold text-foreground hidden sm:block">
              {t('header.brand')}
            </span>
          </div>
        )}
      </div>

      {/* Center: read-only status segments */}
      <div className="flex items-center gap-3">
        <Link
          to="/system/strategy"
          className="flex h-6 items-center gap-1.5 rounded-md border border-border px-2 text-[12px] text-muted hover:text-foreground"
        >
          <span>{t('statusBar.strategy')}</span>
          <span className="text-foreground">{strategy?.name ?? '—'}</span>
        </Link>
        <span className="border-l border-border pl-3 text-[12px] text-muted">
          {t('statusBar.equity')} <span className="font-mono tabular-nums text-foreground">{equityLabel}</span>
        </span>
        <span className="border-l border-border pl-3 text-[12px] text-muted">
          {t('statusBar.realizedPnl')}{' '}
          <span className={cn('font-mono tabular-nums', getSignColorClass(realizedPnl ?? 0))}>{pnlLabel}</span>
        </span>
        <span className="border-l border-border pl-3 text-[12px] text-muted">
          {t('statusBar.riskPerTrade')} <span className="font-mono tabular-nums text-foreground">{riskLabel}</span>
        </span>
        {freshnessSpec && lastResult && (
          <span className="border-l border-border pl-3">
            <Badge variant={freshnessSpec.variant}>
              {t(freshnessSpec.labelKey)} · {lastResult.asofDate}
            </Badge>
          </span>
        )}
      </div>

      {/* Right: review queue + clock */}
      <div className="ml-auto flex items-center gap-3 shrink-0">
        {reviewCount > 0 && (
          <button
            type="button"
            onClick={() => setReviewOpen(true)}
            aria-label={t('reviewQueue.badgeLabel')}
            className="inline-flex items-center"
          >
            <Badge variant="warning">{reviewCount}</Badge>
          </button>
        )}
        <ReviewQueueDrawer open={reviewOpen} onClose={() => setReviewOpen(false)} />
        <div className="hidden md:flex items-center gap-1.5 text-[12px] text-muted">
          <span>{dateStr}</span>
          <span className="font-mono">{timeStr}</span>
        </div>
        <span className="font-mono text-[12px] text-muted md:hidden">{timeStr}</span>
      </div>
    </header>
  );
}
