import Card from '@/components/common/Card';
import { t } from '@/i18n/t';

interface PracticeObjectiveBannerProps {
  date?: string;
  candidateCount: number;
  currentIndex: number;
}

export default function PracticeObjectiveBanner({
  date,
  candidateCount,
  currentIndex,
}: PracticeObjectiveBannerProps) {
  return (
    <Card variant="bordered" className="border-slate-200 bg-slate-950 text-white">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-300">
            {date || t('practice.objective.noSession')}
          </p>
          <h1 className="text-2xl font-semibold">
            {t('practice.objective.title')}
          </h1>
          <p className="text-sm text-slate-300">
            {t('practice.objective.candidateCount', { n: candidateCount })}
          </p>
        </div>
        <div className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium">
          {t('practice.objective.progress', {
            current: Math.min(currentIndex + 1, Math.max(candidateCount, 1)),
            total: candidateCount,
          })}
        </div>
      </div>
    </Card>
  );
}
