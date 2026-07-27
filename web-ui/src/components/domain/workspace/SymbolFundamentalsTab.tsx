import { useState } from 'react';

import Button from '@/components/common/Button';
import FundamentalsSnapshotCard from '@/components/domain/fundamentals/FundamentalsSnapshotCard';
import type { FundamentalSnapshot } from '@/features/fundamentals/types';
import { t } from '@/i18n/t';
import { formatDateTime } from '@/utils/formatters';

export interface SymbolFundamentalsTabModel {
  ticker: string;
  snapshot?: FundamentalSnapshot;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  intelligenceOutdated: boolean;
  screenerFundamentalsInputAsOf?: string | null;
  onRefresh: () => void;
}

interface SymbolFundamentalsTabProps {
  model: SymbolFundamentalsTabModel;
}

export default function SymbolFundamentalsTab({
  model,
}: SymbolFundamentalsTabProps) {
  const [showActivity, setShowActivity] = useState(false);
  const { snapshot } = model;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {snapshot ? (
            <>
              <span
                className={
                  snapshot.freshnessStatus === 'stale'
                    ? 'rounded-full bg-warning/10 px-2 py-1 font-medium text-warning'
                    : 'rounded-full bg-success/10 px-2 py-1 font-medium text-success'
                }
              >
                {snapshot.freshnessStatus === 'stale'
                  ? t('workspacePage.data.stale')
                  : t('workspacePage.data.current')}
              </span>
              <span>{formatDateTime(snapshot.updatedAt)}</span>
            </>
          ) : null}
          {model.isRefreshing ? (
            <span>{t('workspacePage.data.refreshing')}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {snapshot ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowActivity((visible) => !visible)}
            >
              {t('workspacePage.data.showActivity')}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={model.isRefreshing}
            onClick={model.onRefresh}
          >
            {snapshot
              ? t('workspacePage.fundamentals.refresh')
              : t('workspacePage.fundamentals.run')}
          </Button>
        </div>
      </div>

      {showActivity && snapshot ? (
        <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted">
          {t('workspacePage.fundamentals.providerActivity', {
            provider: snapshot.provider,
          })}
        </div>
      ) : null}

      {model.intelligenceOutdated ? (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          {t('workspacePage.fundamentals.intelligenceOutdated')}
        </p>
      ) : null}

      {model.screenerFundamentalsInputAsOf ? (
        <p className="text-xs text-muted">
          {t('workspacePage.fundamentals.screenerInputAsOf', {
            date: formatDateTime(model.screenerFundamentalsInputAsOf),
          })}
        </p>
      ) : null}

      {model.error ? (
        <p className="text-sm text-danger">{model.error.message}</p>
      ) : null}

      {model.isLoading && !snapshot ? (
        <p className="text-sm text-muted">
          {t('workspacePage.fundamentals.loading')}
        </p>
      ) : snapshot ? (
        <FundamentalsSnapshotCard snapshot={snapshot} />
      ) : (
        <p className="text-sm text-muted">
          {t('workspacePage.fundamentals.noSnapshot')}
        </p>
      )}
    </section>
  );
}
