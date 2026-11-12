import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n/I18nProvider';
import Badge from '@/components/common/Badge';
import Select from '@/components/common/Select';
import StrategyCapitalRiskSummary from '@/components/domain/strategy/StrategyCapitalRiskSummary';
import ReviewQueueDrawer from '@/components/domain/pool/ReviewQueueDrawer';
import { usePortfolioSummary } from '@/features/portfolio/hooks';
import { useReviewQueue } from '@/features/pool/hooks';
import {
  useActiveStrategyQuery,
  useSetActiveStrategyMutation,
  useStrategiesQuery,
} from '@/features/strategy/hooks';
import { useScreenerStore } from '@/stores/screenerStore';
import { formatDate } from '@/utils/formatters';
import { cn } from '@/utils/cn';
import { ChevronRight, LogOut, Shield } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider';
import { getResultMarketStatus } from '@/features/screener/resultQuality';

export default function Header({ navigation }: { navigation?: ReactNode }) {
  const now = new Date();
  const { locale, t } = useI18n();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const { user, role, logout } = useAuth();
  const reviewQueueQuery = useReviewQueue();
  const reviewCount = reviewQueueQuery.data?.length ?? 0;

  const strategiesQuery = useStrategiesQuery();
  const activeStrategyQuery = useActiveStrategyQuery();
  const portfolioSummaryQuery = usePortfolioSummary();
  const setActiveMutation = useSetActiveStrategyMutation();
  const strategies = strategiesQuery.data ?? [];
  const activeId = activeStrategyQuery.data?.id ?? '';
  const isLoading = strategiesQuery.isLoading || activeStrategyQuery.isLoading;

  const todayRunResult = useScreenerStore((s) => s.todayRun?.result);
  const lastResultFallback = useScreenerStore((s) => s.lastResult);
  const reviewSource = todayRunResult ?? lastResultFallback;
  const marketStatus = getResultMarketStatus(reviewSource);
  const isFinal = marketStatus === 'final_close';
  const hasQueryError =
    reviewQueueQuery.isError ||
    portfolioSummaryQuery.isError ||
    strategiesQuery.isError ||
    activeStrategyQuery.isError;
  const hasActionError = setActiveMutation.isError || Boolean(logoutError);
  const hasHealthError = hasQueryError || hasActionError;
  const healthLabel = hasHealthError
    ? t('header.dataHealth.partial')
    : t(`screener.quality.market.${marketStatus}`);
  const healthClass = hasHealthError
    ? 'border-danger/40 bg-danger/10 text-danger'
    : isFinal
      ? 'border-success/40 bg-success/10 text-success'
      : 'border-warning/40 bg-warning/10 text-warning';
  const strategyError = setActiveMutation.isError
    ? setActiveMutation.error instanceof Error
      ? setActiveMutation.error.message
      : t('sidebar.updateError')
    : null;
  const handleLogout = () => {
    setLogoutError(null);
    void logout().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : '';
      setLogoutError(message && message !== 'Failed to sign out' ? message : t('sidebar.logoutError'));
    });
  };

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

  return (
    <header className="flex min-h-[77px] flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-surface px-4 py-3 sm:px-6">
      {navigation}
      <div className="min-w-0 flex-1 basis-32 sm:max-w-xs">
        <label htmlFor="workspace-active-strategy" className="mb-1 block text-xs font-semibold text-muted">{t('sidebar.activeStrategy')}</label>
        <Select
          id="workspace-active-strategy"
          value={activeId}
          onChange={(e) => {
            if (e.target.value && e.target.value !== activeId) {
              setActiveMutation.mutate(e.target.value);
            }
          }}
          aria-label={t('sidebar.activeStrategy')}
          className={cn(
            'min-h-11 rounded-lg px-2 py-1 text-sm',
            'focus:ring-1 focus:border-primary',
            'disabled:opacity-50'
          )}
          disabled={isLoading || setActiveMutation.isPending}
        >
          {isLoading && <option value="">{t('sidebar.loadingStrategies')}</option>}
          {!isLoading && !strategies.length && <option value="">{t('sidebar.noStrategies')}</option>}
          {!isLoading && !activeId && <option value="">{t('sidebar.selectStrategy')}</option>}
          {!isLoading && strategies.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        {strategyError ? (
          <p role="alert" className="mt-1 text-xs text-danger">{strategyError}</p>
        ) : null}
      </div>

      <div className="min-w-0 flex flex-wrap items-center gap-2">
        <span
          data-testid="data-health-dot"
          aria-hidden="true"
          className={cn(
            'h-[9px] w-[9px] rounded-full',
            hasHealthError ? 'bg-danger' : isFinal ? 'bg-success' : 'bg-warning',
          )}
        />
        <Link
          to="/today#scan-data-quality"
          aria-label={`${healthLabel}. ${t('screener.quality.inspect')}`}
          className={cn(
            'inline-flex min-h-11 min-w-0 flex-wrap items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
            healthClass,
          )}
        >
          <span>{healthLabel}</span>
          {reviewSource ? (
            <span className="font-normal text-muted">{formatDate(reviewSource.asofDate)}</span>
          ) : null}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-3 sm:basis-0 sm:justify-end">
        {reviewCount > 0 && (
          <button
            type="button"
            onClick={() => setReviewOpen(true)}
            aria-label={t('reviewQueue.badgeLabel')}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-foreground/5"
          >
            <Badge variant="warning">{reviewCount}</Badge>
          </button>
        )}
        <ReviewQueueDrawer open={reviewOpen} onClose={() => setReviewOpen(false)} />
        <details className="group relative">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium marker:content-none hover:bg-foreground/5 [&::-webkit-details-marker]:hidden">
            <Shield className="h-4 w-4 text-primary" aria-hidden="true" />
            {t('header.riskPolicy')}
            <ChevronRight className="h-4 w-4 text-muted group-open:rotate-90" aria-hidden="true" />
          </summary>
          <div className="z-20 mt-2 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface p-3 shadow-lg sm:absolute sm:right-0 sm:w-80">
            <StrategyCapitalRiskSummary
              strategy={activeStrategyQuery.data}
              equitySnapshot={portfolioSummaryQuery.data ? {
                effectiveAccountSize: portfolioSummaryQuery.data.effectiveAccountSize,
                realizedPnl: portfolioSummaryQuery.data.realizedPnl,
              } : undefined}
              variant="compact"
            />
          </div>
        </details>
        <div className="hidden flex-wrap items-center gap-1.5 text-xs text-muted 2xl:flex">
          <span>{dateStr}</span>
          <span className="font-mono">{timeStr}</span>
        </div>
        <div className="min-w-0 flex flex-wrap items-center gap-2 border-l border-border pl-3 text-[12px] text-muted">
          <span className="max-w-36 truncate">{user?.display_name || user?.email || user?.subject}</span>
          <Badge variant={role === 'admin' ? 'success' : 'default'}>{role}</Badge>
          <button
            type="button"
            title={t('sidebar.signOut')}
            aria-label={t('sidebar.signOut')}
            onClick={handleLogout}
            className="grid h-11 w-11 place-items-center rounded-lg text-muted hover:bg-foreground/5 hover:text-foreground"
          >
            <LogOut size={15} aria-hidden="true" />
          </button>
          {logoutError ? (
            <p role="alert" className="max-w-52 text-xs text-danger">{logoutError}</p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
