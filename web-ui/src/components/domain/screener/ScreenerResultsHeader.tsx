import { TrendingUp, RefreshCw, AlertCircle } from 'lucide-react';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import OverlayBadge from '@/components/domain/recommendation/OverlayBadge';
import { t } from '@/i18n/t';
import { SocialWarmupStatus } from '@/features/social/types';

interface ScreenerResultsHeaderProps {
  candidatesCount: number;
  allCandidatesCount: number;
  totalScreened: number;
  asofDate: string;
  isFiltered: boolean;
  warnings: string[];
  socialWarmupJobId?: string;
  socialWarmup?: SocialWarmupStatus | null;
  socialWarmupNotFound: boolean;
  overlayCounts: Record<string, number>;
  onRefresh: () => void;
}

export default function ScreenerResultsHeader({
  candidatesCount,
  allCandidatesCount,
  totalScreened,
  asofDate,
  isFiltered,
  warnings,
  socialWarmupJobId,
  socialWarmup,
  socialWarmupNotFound,
  overlayCounts,
  onRefresh,
}: ScreenerResultsHeaderProps) {
  return (
    <Card variant="bordered">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <TrendingUp className="w-6 h-6 text-green-600 mr-2" />
          <div>
            <p className="text-sm text-gray-600">{t('screener.summary.completed')}</p>
            <p className="text-lg font-semibold text-gray-900">
              {isFiltered && candidatesCount < allCandidatesCount
                ? t('screener.summary.resultLineFiltered', {
                    count: candidatesCount,
                    total: allCandidatesCount,
                    screened: totalScreened,
                  })
                : t('screener.summary.resultLine', {
                    count: candidatesCount,
                    total: totalScreened,
                  })}
            </p>
            <p className="text-xs text-gray-500">{t('screener.summary.asOf', { date: asofDate })}</p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onRefresh}
          title={t('screener.controls.refreshTitle')}
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          {t('screener.controls.refresh')}
        </Button>
      </div>
      {warnings.length > 0 && (
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start">
          <AlertCircle className="w-4 h-4 text-yellow-700 mr-2 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            {warnings.map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        </div>
      )}
      {socialWarmupJobId && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          {socialWarmupNotFound
            ? t('screener.summary.socialWarmupUnavailable')
            : socialWarmup == null
            ? t('screener.summary.socialWarmupLoading')
            : socialWarmup.status === 'completed'
              ? t('screener.summary.socialWarmupCompleted', {
                  completed: socialWarmup.completedSymbols,
                  total: socialWarmup.totalSymbols,
                  ok: socialWarmup.okSymbols,
                  noData: socialWarmup.noDataSymbols,
                  errors: socialWarmup.errorSymbols,
                })
              : t('screener.summary.socialWarmupRunning', {
                  completed: socialWarmup.completedSymbols,
                  total: socialWarmup.totalSymbols,
                  ok: socialWarmup.okSymbols,
                  noData: socialWarmup.noDataSymbols,
                  errors: socialWarmup.errorSymbols,
                })}
        </div>
      )}
      {candidatesCount > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {Object.entries(overlayCounts).map(([status, count]) => {
            return (
              <span key={status} className="inline-flex items-center gap-1">
                <OverlayBadge status={status} title={t('screener.table.overlayStatusTitle', { status })} />
                <span>{count}</span>
              </span>
            );
          })}
        </div>
      )}
    </Card>
  );
}
