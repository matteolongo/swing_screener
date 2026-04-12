import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import Card from '@/components/common/Card';
import type { PositionCaseStudy } from '@/features/practice/types';
import { t } from '@/i18n/t';
import { formatCurrency, formatNumber } from '@/utils/formatters';

interface PositionCaseStudyCardProps {
  caseStudy: PositionCaseStudy;
}

export default function PositionCaseStudyCard({ caseStudy }: PositionCaseStudyCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card variant="bordered" className="space-y-4 p-4">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">{t('review.caseStudy.title')}</p>
            <h3 className="text-lg font-semibold">{caseStudy.position.ticker}</h3>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Entry</p>
            <p className="font-medium">{formatCurrency(caseStudy.position.entryPrice)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Stop</p>
            <p className="font-medium">{formatCurrency(caseStudy.position.stopPrice)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Current</p>
            <p className="font-medium">
              {caseStudy.position.currentPrice != null ? formatCurrency(caseStudy.position.currentPrice) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">R now</p>
            <p className="font-medium">
              {caseStudy.currentRNow != null ? `${caseStudy.currentRNow > 0 ? '+' : ''}${formatNumber(caseStudy.currentRNow, 2)}R` : '—'}
            </p>
          </div>
        </div>
      </button>

      {expanded ? (
        <div className="grid gap-4 border-t border-slate-200 pt-4 text-sm dark:border-slate-700 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('review.caseStudy.keyQuestion')}</p>
            <p className="mt-2 text-slate-700 dark:text-slate-300">{caseStudy.keyQuestion}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('review.caseStudy.invalidationCheck')}</p>
            <p className="mt-2 text-slate-700 dark:text-slate-300">{caseStudy.invalidationCheck ?? 'Document the price level or evidence that would prove you are wrong.'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('review.caseStudy.nextMilestone')}</p>
            <p className="mt-2 text-slate-700 dark:text-slate-300">{caseStudy.nextMilestone ?? 'Define the next milestone before making another portfolio decision.'}</p>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
