import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import StrategyCapitalRiskSummary from '@/components/domain/strategy/StrategyCapitalRiskSummary';
import { usePortfolioSummary } from '@/features/portfolio/hooks';
import {
  useActiveStrategyQuery,
  useSetActiveStrategyMutation,
  useStrategiesQuery,
} from '@/features/strategy/hooks';
import { cn } from '@/utils/cn';

interface HeaderProps {
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

export default function Header({ isSidebarCollapsed = false, onToggleSidebar }: HeaderProps) {
  const now = new Date();
  const { locale, t } = useI18n();

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
    <header className="h-12 px-4 border-b border-border bg-surface flex items-center justify-between gap-4 shrink-0">
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

      {/* Center: strategy selector */}
      <div className="flex-1 max-w-xs">
        <select
          value={activeId}
          onChange={(e) => {
            if (e.target.value && e.target.value !== activeId) {
              setActiveMutation.mutate(e.target.value);
            }
          }}
          aria-label={t('sidebar.activeStrategy')}
          className={cn(
            'w-full h-7 px-2 text-[13px] border border-border rounded',
            'bg-surface text-foreground',
            'focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary',
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
        </select>
      </div>

      {/* Right: risk summary + clock */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden xl:block">
          <StrategyCapitalRiskSummary
            strategy={activeStrategyQuery.data}
            equitySnapshot={portfolioSummaryQuery.data ? {
              effectiveAccountSize: portfolioSummaryQuery.data.effectiveAccountSize,
              realizedPnl: portfolioSummaryQuery.data.realizedPnl,
            } : undefined}
            variant="compact"
            className="max-w-[42rem]"
          />
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-[12px] text-muted">
          <span>{dateStr}</span>
          <span className="font-mono">{timeStr}</span>
        </div>
        <span className="font-mono text-[12px] text-muted md:hidden">{timeStr}</span>
      </div>
    </header>
  );
}
