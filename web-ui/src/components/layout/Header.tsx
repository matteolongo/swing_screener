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
import { cn } from '@/utils/cn';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider';

export default function Header() {
  const now = new Date();
  const { locale, t } = useI18n();
  const [reviewOpen, setReviewOpen] = useState(false);
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
            title="Sign out"
            aria-label="Sign out"
            onClick={() => { void logout(); }}
            className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-surface-hover hover:text-foreground"
          >
            <LogOut size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
