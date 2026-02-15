import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import { useConfigStore } from '@/stores/configStore';
import {
  Position,
  calculatePnL,
} from '@/features/portfolio/types';
import { calcOpenRisk, calcOpenRiskPct, calcTotalPositionValue } from '@/features/portfolio/metrics';
import {
  useOpenPositions,
  useOrders,
  useOrderSnapshots,
} from '@/features/portfolio/hooks';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { TrendingUp, AlertCircle, FileText, Search, RefreshCw, CalendarCheck } from 'lucide-react';
import StrategyCoachCard from '@/components/domain/education/StrategyCoachCard';
import IntelligenceOpportunityCard from '@/components/domain/intelligence/IntelligenceOpportunityCard';
import { buildFallbackStrategyCoachSections, buildStrategyCoachSections } from '@/content/strategyCoach';
import { useActiveStrategyQuery } from '@/features/strategy/hooks';
import {
  useIntelligenceOpportunitiesScoped,
  useIntelligenceRunStatus,
  useRunIntelligenceMutation,
} from '@/features/intelligence/hooks';
import { t } from '@/i18n/t';

export default function Dashboard() {
  const { config } = useConfigStore();
  const navigate = useNavigate();
  const activeStrategyQuery = useActiveStrategyQuery();
  const riskConfig = activeStrategyQuery.data?.risk ?? config.risk;

  const { data: positions = [] } = useOpenPositions();
  const { data: orders = [] } = useOrders('pending');
  const {
    data: orderSnapshots,
    isFetching: isFetchingSnapshots,
    isError: isSnapshotError,
    refetch: refetchSnapshots,
  } = useOrderSnapshots();

  const snapshotOrders = orderSnapshots?.orders ?? [];

  // Calculate portfolio metrics
  const totalPositionValue = calcTotalPositionValue(positions);
  const totalPnL = positions.reduce((sum: number, pos: Position) => {
    return sum + calculatePnL(pos);
  }, 0);

  const openRisk = calcOpenRisk(positions);
  const openRiskPct = calcOpenRiskPct(openRisk, riskConfig.accountSize);
  const riskBudget = riskConfig.accountSize * riskConfig.riskPct;
  const availableToDeploy = riskConfig.accountSize - totalPositionValue;

  const pendingOrdersCount = orders.length;
  const intelligenceSymbols = useMemo(
    () =>
      Array.from(
        new Set(
          [...positions.map((position) => position.ticker), ...orders.map((order) => order.ticker)].filter(
            (ticker) => ticker && ticker.trim().length > 0
          )
        )
      ),
    [orders, positions]
  );
  const [intelligenceJobId, setIntelligenceJobId] = useState<string>();
  const [intelligenceAsofDate, setIntelligenceAsofDate] = useState<string>();
  const [intelligenceRunSymbols, setIntelligenceRunSymbols] = useState<string[]>([]);
  const runIntelligenceMutation = useRunIntelligenceMutation((launch) => {
    setIntelligenceJobId(launch.jobId);
    setIntelligenceAsofDate(undefined);
  });
  const intelligenceStatusQuery = useIntelligenceRunStatus(intelligenceJobId);
  const intelligenceStatus = intelligenceStatusQuery.data;
  const intelligenceOpportunitiesQuery = useIntelligenceOpportunitiesScoped(
    intelligenceAsofDate,
    intelligenceRunSymbols,
    Boolean(intelligenceAsofDate)
  );
  const intelligenceOpportunities = intelligenceOpportunitiesQuery.data?.opportunities ?? [];

  useEffect(() => {
    if (intelligenceStatus?.status === 'completed' && intelligenceStatus.asofDate) {
      setIntelligenceAsofDate(intelligenceStatus.asofDate);
    }
  }, [intelligenceStatus?.asofDate, intelligenceStatus?.status]);

  const handleRunIntelligence = () => {
    if (!intelligenceSymbols.length) {
      return;
    }
    const scopedSymbols = intelligenceSymbols.slice(0, 50);
    setIntelligenceRunSymbols(scopedSymbols);
    runIntelligenceMutation.mutate({
      symbols: scopedSymbols,
    });
  };

  const isNewUser = positions.length === 0 && orders.length === 0;
  const strategyCoachSections = activeStrategyQuery.data
    ? buildStrategyCoachSections(activeStrategyQuery.data)
    : buildFallbackStrategyCoachSections(config);
  const strategyCoachSubtitle = activeStrategyQuery.data
    ? t('dashboardPage.strategyCoach.subtitleActive')
    : activeStrategyQuery.isError
      ? t('dashboardPage.strategyCoach.subtitleFallback')
      : t('dashboardPage.strategyCoach.subtitleLoading');


  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">{t('dashboardPage.header.title')}</h1>

      {/* Portfolio Status - At-a-Glance Hero */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>{t('dashboardPage.portfolioSummary.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Primary Row - Most Important Metrics */}
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('dashboardPage.portfolioSummary.openPositions')}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold">{positions.length}</p>
                <p className={`text-lg font-semibold ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {t('dashboardPage.portfolioSummary.totalPnlDetail')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('dashboardPage.portfolioSummary.openRiskAtStops')}</p>
              <p className="text-3xl font-bold">{formatCurrency(openRisk)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {formatPercent(openRiskPct * 100)} {t('dashboardPage.portfolioSummary.ofAccount')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('dashboardPage.portfolioSummary.availableToDeploy')}</p>
              <p className="text-3xl font-bold">{formatCurrency(availableToDeploy)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {formatPercent((availableToDeploy / riskConfig.accountSize) * 100)} {t('dashboardPage.portfolioSummary.ofAccount')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            {/* Secondary Row - Context Metrics */}
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('dashboardPage.portfolioSummary.accountSize')}</p>
              <p className="text-xl font-bold">{formatCurrency(riskConfig.accountSize)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('dashboardPage.portfolioSummary.riskBudgetPerTrade')}</p>
              <p className="text-xl font-bold">{formatCurrency(riskBudget)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {(riskConfig.riskPct * 100).toFixed(2)}% {t('dashboardPage.portfolioSummary.perTrade')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('dashboardPage.portfolioSummary.positionValue')}</p>
              <p className="text-xl font-bold">{formatCurrency(totalPositionValue)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions Bar */}
      <Card variant="bordered">
        <CardContent className="py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              variant="secondary"
              className="h-16 flex flex-col items-center justify-center gap-1"
              onClick={() => navigate('/screener')}
            >
              <Search className="w-5 h-5" />
              <span className="text-sm">{t('dashboardPage.quickActions.runScreener')}</span>
            </Button>
            {positions.length > 0 && (
              <Button
                variant="secondary"
                className="h-16 flex flex-col items-center justify-center gap-1 relative"
                onClick={() => navigate('/daily-review')}
              >
                <CalendarCheck className="w-5 h-5" />
                <span className="text-sm">{t('dashboardPage.quickActions.dailyReview')}</span>
                {positions.length > 0 && (
                  <Badge variant="primary" className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 text-xs">
                    {positions.length}
                  </Badge>
                )}
              </Button>
            )}
            <Button
              variant="secondary"
              className="h-16 flex flex-col items-center justify-center gap-1 relative"
              onClick={() => navigate('/positions')}
            >
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm">{t('dashboardPage.quickActions.managePositions')}</span>
              {positions.length > 0 && (
                <Badge variant="success" className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 text-xs">
                  {positions.length}
                </Badge>
              )}
            </Button>
            <Button
              variant="secondary"
              className="h-16 flex flex-col items-center justify-center gap-1 relative"
              onClick={() => navigate('/orders')}
            >
              <FileText className="w-5 h-5" />
              <span className="text-sm">{t('dashboardPage.quickActions.viewOrders')}</span>
              {pendingOrdersCount > 0 && (
                <Badge variant="warning" className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 text-xs">
                  {pendingOrdersCount}
                </Badge>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <StrategyCoachCard
        strategyName={activeStrategyQuery.data?.name}
        subtitle={strategyCoachSubtitle}
        sections={strategyCoachSections}
        isLoading={activeStrategyQuery.isLoading && !activeStrategyQuery.data}
        defaultCollapsed={true}
      />

      <Card variant="bordered">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{t('dashboardPage.intelligence.title')}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {t('dashboardPage.intelligence.subtitle')}
            </p>
            <p className="text-xs text-gray-500">
              {t('dashboardPage.intelligence.symbolsLine', {
                count: intelligenceSymbols.length,
                symbols:
                  intelligenceSymbols.slice(0, 6).join(', ') || t('dashboardPage.intelligence.noneSymbol'),
              })}
            </p>
          </div>
          <Button
            onClick={handleRunIntelligence}
            disabled={!intelligenceSymbols.length || runIntelligenceMutation.isPending}
          >
            {runIntelligenceMutation.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                {t('dashboardPage.intelligence.runningAction')}
              </>
            ) : (
              t('dashboardPage.intelligence.runAction')
            )}
          </Button>
        </div>

        {!intelligenceSymbols.length && (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
            {t('dashboardPage.intelligence.noSymbols')}
          </p>
        )}

        {runIntelligenceMutation.isError && (
          <p className="mt-3 text-sm text-red-600">
            {t('dashboardPage.intelligence.startError', {
              error:
                runIntelligenceMutation.error instanceof Error
                  ? runIntelligenceMutation.error.message
                  : t('common.errors.generic'),
            })}
          </p>
        )}

        {intelligenceStatus && (
          <div className="mt-4 rounded-md border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {intelligenceStatus.status === 'completed' &&
                t('dashboardPage.intelligence.statusCompleted', {
                  completed: intelligenceStatus.completedSymbols,
                  total: intelligenceStatus.totalSymbols,
                  opportunities: intelligenceStatus.opportunitiesCount,
                })}
              {intelligenceStatus.status === 'queued' &&
                t('dashboardPage.intelligence.statusQueued', {
                  total: intelligenceStatus.totalSymbols,
                })}
              {intelligenceStatus.status === 'running' &&
                t('dashboardPage.intelligence.statusRunning', {
                  completed: intelligenceStatus.completedSymbols,
                  total: intelligenceStatus.totalSymbols,
                })}
              {intelligenceStatus.status === 'error' &&
                t('dashboardPage.intelligence.statusError', {
                  error: intelligenceStatus.error || t('common.errors.generic'),
                })}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {t('dashboardPage.intelligence.updatedAt', {
                updatedAt: intelligenceStatus.updatedAt,
              })}
            </p>
          </div>
        )}

        {intelligenceStatusQuery.isError && !intelligenceStatus && (
          <p className="mt-3 text-sm text-red-600">
            {t('dashboardPage.intelligence.statusLoadError')}
          </p>
        )}

        {intelligenceAsofDate && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                {t('dashboardPage.intelligence.opportunitiesTitle', { date: intelligenceAsofDate })}
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => intelligenceOpportunitiesQuery.refetch()}
                disabled={intelligenceOpportunitiesQuery.isFetching}
              >
                {t('dashboardPage.intelligence.refreshOpportunities')}
              </Button>
            </div>

            {intelligenceOpportunitiesQuery.isFetching && (
              <p className="text-sm text-gray-600">{t('dashboardPage.intelligence.loading')}</p>
            )}

            {!intelligenceOpportunitiesQuery.isFetching && intelligenceOpportunities.length === 0 && (
              <p className="text-sm text-gray-600">{t('dashboardPage.intelligence.empty')}</p>
            )}

            {intelligenceOpportunities.length > 0 && (
              <div className="space-y-2">
                {intelligenceOpportunities.slice(0, 8).map((opportunity) => (
                  <IntelligenceOpportunityCard key={opportunity.symbol} opportunity={opportunity} />
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Priority Actions - Merged Action Items + Orders Snapshot */}
      <Card variant="bordered">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>{t('dashboardPage.priorityActions.title')}</CardTitle>
          {snapshotOrders.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => refetchSnapshots()}
              disabled={isFetchingSnapshots}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isFetchingSnapshots ? 'animate-spin' : ''}`} />
              {t('dashboardPage.priorityActions.refreshPrices')}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isSnapshotError && (
            <div className="mb-3 p-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded">
              {t('dashboardPage.openOrdersSnapshot.loadError')}
            </div>
          )}
          
          {pendingOrdersCount === 0 && positions.length === 0 ? (
            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400 py-2">
              <AlertCircle className="w-5 h-5 text-green-500" />
              <p>{t('dashboardPage.priorityActions.allCaughtUp')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Pending Orders with Snapshot Data */}
              {pendingOrdersCount > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <h3 className="font-semibold text-sm">
                      {pendingOrdersCount === 1
                        ? t('dashboardPage.actionItems.pendingOrderSingular', { count: pendingOrdersCount })
                        : t('dashboardPage.actionItems.pendingOrderPlural', { count: pendingOrdersCount })}
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {snapshotOrders.slice(0, 5).map((order) => (
                      <div key={order.orderId} className="flex items-center justify-between text-sm border-l-2 border-blue-400 pl-3 py-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="warning">{order.ticker}</Badge>
                          <span className="text-gray-700 dark:text-gray-300">{order.orderType}</span>
                          <span className="text-gray-500">×{order.quantity}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          {order.lastPrice !== undefined && (
                            <>
                              <span className="text-gray-900 dark:text-gray-100 font-medium">
                                {formatCurrency(order.lastPrice)}
                              </span>
                              {order.pctToLimit !== undefined && (
                                <span className={order.pctToLimit < 0 ? 'text-red-600' : 'text-gray-600'}>
                                  {formatPercent(order.pctToLimit)} to fill
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {snapshotOrders.length > 5 && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate('/orders')}
                        className="w-full"
                      >
                        {t('dashboardPage.actionItems.viewAllOrders', { count: snapshotOrders.length })}
                      </Button>
                    )}
                  </div>
                </div>
              )}
              
              {/* Open Positions Summary */}
              {positions.length > 0 && (
                <div className={pendingOrdersCount > 0 ? 'pt-4 border-t' : ''}>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <h3 className="font-semibold text-sm">
                      {positions.length === 1
                        ? t('dashboardPage.actionItems.openPositionSingular', { count: positions.length })
                        : t('dashboardPage.actionItems.openPositionPlural', { count: positions.length })}
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {positions.slice(0, 3).map((pos: Position) => {
                      const pnl = calculatePnL(pos);
                      return (
                        <div key={pos.positionId} className="flex items-center justify-between text-sm border-l-2 border-green-400 pl-3 py-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="success">{pos.ticker}</Badge>
                            <span className="text-gray-500">×{pos.shares}</span>
                            <span className="text-gray-700 dark:text-gray-300">{formatCurrency(pos.entryPrice)}</span>
                          </div>
                          <span className={`text-sm font-medium ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                          </span>
                        </div>
                      );
                    })}
                    {positions.length > 3 && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate('/positions')}
                        className="w-full"
                      >
                        {t('dashboardPage.actionItems.viewAllPositions', { count: positions.length })}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Getting Started - Only for new users */}
      {isNewUser && (
        <Card variant="bordered" className="bg-primary/5">
          <CardHeader>
            <CardTitle>{t('dashboardPage.gettingStarted.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              {t('dashboardPage.gettingStarted.subtitle')}
            </p>
            <ol className="list-decimal pl-5 space-y-2 text-sm">
              <li>{t('dashboardPage.gettingStarted.step1Prefix')} <a href="/settings" className="text-primary underline">{t('dashboardPage.gettingStarted.step1LinkLabel')}</a> {t('dashboardPage.gettingStarted.step1Suffix')}</li>
              <li>{t('dashboardPage.gettingStarted.step2')}</li>
              <li>{t('dashboardPage.gettingStarted.step3')}</li>
              <li>{t('dashboardPage.gettingStarted.step4')}</li>
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
