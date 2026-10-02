import { useState } from 'react';
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
import { LogOut } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider';

export default function Header() {
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
  const isFinal = (reviewSource?.dataFreshness ?? 'intraday') === 'final_close';
  const hasQueryError =
    reviewQueueQuery.isError ||
    portfolioSummaryQuery.isError ||
    strategiesQuery.isError ||
    activeStrategyQuery.isError;
  const hasActionError = setActiveMutation.isError || Boolean(logoutError);
  const hasHealthError = hasQueryError || hasActionError;
  const healthLabel = hasHealthError
    ? t('header.dataHealth.partial')
    : isFinal
      ? t('cockpit.strip.finalClose')
      : t('cockpit.strip.intradayPreview');
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
    <header className="h-12 px-4 border-b border-border bg-surface flex items-center gap-4 shrink-0">
      <div className="flex-1 max-w-xs">
        <Select
          value={activeId}
          onChange={(e) => {
            if (e.target.value && e.target.value !== activeId) {
              setActiveMutation.mutate(e.target.value);
            }
          }}
          aria-label={t('sidebar.activeStrategy')}
          className={cn(
            'h-7 px-2 text-[13px] rounded',
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

      <div className="flex items-center gap-2 shrink-0">
        <span
          data-testid="data-health-dot"
          aria-hidden="true"
          className={cn(
            'h-[9px] w-[9px] rounded-full',
            hasHealthError ? 'bg-danger' : isFinal ? 'bg-success' : 'bg-warning',
          )}
        />
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium',
            healthClass,
          )}
        >
          <span>{healthLabel}</span>
          {reviewSource ? (
            <span className="font-normal text-muted">{formatDate(reviewSource.asofDate)}</span>
          ) : null}
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
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
        <StrategyCapitalRiskSummary
          strategy={activeStrategyQuery.data}
          equitySnapshot={portfolioSummaryQuery.data ? {
            effectiveAccountSize: portfolioSummaryQuery.data.effectiveAccountSize,
            realizedPnl: portfolioSummaryQuery.data.realizedPnl,
          } : undefined}
          variant="compact"
          className="max-w-[42rem]"
        />
        <div className="flex items-center gap-1.5 text-[12px] text-muted">
          <span>{dateStr}</span>
          <span className="font-mono">{timeStr}</span>
        </div>
        <div className="flex items-center gap-2 border-l border-border pl-3 text-[12px] text-muted">
          <span className="max-w-36 truncate">{user?.display_name || user?.email || user?.subject}</span>
          <Badge variant={role === 'admin' ? 'success' : 'default'}>{role}</Badge>
          <button
            type="button"
            title={t('sidebar.signOut')}
            aria-label={t('sidebar.signOut')}
            onClick={handleLogout}
            className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-foreground/5 hover:text-foreground"
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
