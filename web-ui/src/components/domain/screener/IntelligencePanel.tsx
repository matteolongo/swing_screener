import { RefreshCw, Sparkles } from 'lucide-react';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import IntelligenceOpportunityCard from '@/components/domain/intelligence/IntelligenceOpportunityCard';
import { t } from '@/i18n/t';
import { UseQueryResult } from '@tanstack/react-query';
import { IntelligenceRunStatus, IntelligenceOpportunitiesResponse } from '@/features/intelligence/types';

interface IntelligencePanelProps {
  hasCandidates: boolean;
  intelligenceAsofDate: string;
  intelligenceJobId?: string;
  intelligenceStatus: UseQueryResult<IntelligenceRunStatus>;
  intelligenceOpportunities: UseQueryResult<IntelligenceOpportunitiesResponse>;
  isRunningIntelligence: boolean;
  onRunIntelligence: () => void;
}

export default function IntelligencePanel({
  hasCandidates,
  intelligenceAsofDate,
  intelligenceJobId,
  intelligenceStatus,
  intelligenceOpportunities,
  isRunningIntelligence,
  onRunIntelligence,
}: IntelligencePanelProps) {
  if (!hasCandidates && !intelligenceAsofDate) {
    return null;
  }

  return (
    <Card>
      <div className="space-y-4">
        {/* Run Intelligence button */}
        {hasCandidates && !intelligenceJobId && !intelligenceStatus.data && (
          <Button
            onClick={onRunIntelligence}
            disabled={isRunningIntelligence}
            variant="secondary"
          >
            {isRunningIntelligence ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                {t('screener.intelligence.runningAction')}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                {t('screener.intelligence.runAction')}
              </>
            )}
          </Button>
        )}

        {/* Intelligence status and results */}
        {intelligenceStatus.data && (
          <div>
            {intelligenceStatus.data.status === 'completed' && intelligenceAsofDate && (
              <>
                <p className="text-sm text-green-700 mb-3">
                  {t('screener.intelligence.statusCompleted', {
                    completed: intelligenceStatus.data.completedSymbols,
                    total: intelligenceStatus.data.totalSymbols,
                    opportunities: intelligenceStatus.data.opportunitiesCount,
                  })}
                </p>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    {t('screener.intelligence.opportunitiesTitle', {
                      date: intelligenceAsofDate,
                    })}
                  </h3>
                  <div className="mb-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => intelligenceOpportunities.refetch()}
                      disabled={intelligenceOpportunities.isFetching}
                    >
                      {t('screener.intelligence.refreshOpportunities')}
                    </Button>
                  </div>
                  {intelligenceOpportunities.isError ? (
                    <p className="text-sm text-red-700">{t('screener.intelligence.statusLoadError')}</p>
                  ) : null}
                  {intelligenceOpportunities.data && intelligenceOpportunities.data.opportunities.length > 0 ? (
                    <div className="space-y-3">
                      {intelligenceOpportunities.data.opportunities.map((opp) => (
                        <IntelligenceOpportunityCard key={opp.symbol} opportunity={opp} />
                      ))}
                    </div>
                  ) : intelligenceOpportunities.isLoading || intelligenceOpportunities.isFetching ? (
                    <p className="text-sm text-gray-600">{t('screener.intelligence.loading')}</p>
                  ) : (
                    <p className="text-sm text-gray-600">{t('screener.intelligence.empty')}</p>
                  )}
                </div>
              </>
            )}
            {(intelligenceStatus.data.status === 'queued' || intelligenceStatus.data.status === 'running') && (
              <p className="text-sm text-blue-700">
                {t('screener.intelligence.statusRunning', {
                  completed: intelligenceStatus.data.completedSymbols,
                  total: intelligenceStatus.data.totalSymbols,
                })}
              </p>
            )}
            {intelligenceStatus.data.status === 'error' && (
              <p className="text-sm text-red-700">
                {t('screener.intelligence.statusError', {
                  error: intelligenceStatus.data.error || t('common.errors.generic'),
                })}
              </p>
            )}
          </div>
        )}
        {!intelligenceStatus.data && intelligenceAsofDate && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              {t('screener.intelligence.opportunitiesTitle', {
                date: intelligenceAsofDate,
              })}
            </h3>
            <div className="mb-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => intelligenceOpportunities.refetch()}
                disabled={intelligenceOpportunities.isFetching}
              >
                {t('screener.intelligence.refreshOpportunities')}
              </Button>
            </div>
            {intelligenceOpportunities.isError ? (
              <p className="text-sm text-red-700">{t('screener.intelligence.statusLoadError')}</p>
            ) : null}
            {intelligenceOpportunities.data && intelligenceOpportunities.data.opportunities.length > 0 ? (
              <div className="space-y-3">
                {intelligenceOpportunities.data.opportunities.map((opp) => (
                  <IntelligenceOpportunityCard key={opp.symbol} opportunity={opp} />
                ))}
              </div>
            ) : intelligenceOpportunities.isLoading || intelligenceOpportunities.isFetching ? (
              <p className="text-sm text-gray-600">{t('screener.intelligence.loading')}</p>
            ) : (
              <p className="text-sm text-gray-600">{t('screener.intelligence.empty')}</p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
