import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { StrategyCoachSection } from '@/content/strategyCoach';
import { t } from '@/i18n/t';

interface StrategyCoachCardProps {
  strategyName?: string;
  subtitle?: string;
  sections: StrategyCoachSection[];
  isLoading?: boolean;
  defaultCollapsed?: boolean;
}

export default function StrategyCoachCard({
  strategyName,
  subtitle,
  sections,
  isLoading = false,
  defaultCollapsed = false,
}: StrategyCoachCardProps) {
  const [isExpanded, setIsExpanded] = useState(!defaultCollapsed);

  return (
    <Card variant="bordered">
      <CardHeader className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>{t('strategyCoach.title')}</CardTitle>
          {strategyName ? (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t('strategyCoach.activeLabel')} <span className="font-medium">{strategyName}</span>
            </p>
          ) : null}
          {subtitle ? (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{subtitle}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? t('strategyCoach.actions.collapseAria') : t('strategyCoach.actions.expandAria')}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              {t('strategyCoach.actions.collapse')}
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              {t('strategyCoach.actions.expand')}
            </>
          )}
        </button>
      </CardHeader>
      {isExpanded ? (
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {t('strategyCoach.loading')}
            </div>
          ) : (
            <div className="space-y-4">
              {sections.map((section) => (
                <section key={section.title}>
                  <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                    {section.title}
                  </h4>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                    {section.explanation}
                  </p>
                  {section.formula ? (
                    <p className="mt-2 inline-block rounded bg-gray-100 dark:bg-gray-700 px-2 py-1 text-xs font-mono">
                      {section.formula}
                    </p>
                  ) : null}
                  {section.example ? (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      {t('strategyCoach.examplePrefix')} {section.example}
                    </p>
                  ) : null}
                </section>
              ))}
            </div>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}
