import Card, { CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { StrategyCoachSection } from '@/content/strategyCoach';

interface StrategyCoachCardProps {
  strategyName?: string;
  subtitle?: string;
  sections: StrategyCoachSection[];
  isLoading?: boolean;
}

export default function StrategyCoachCard({
  strategyName,
  subtitle,
  sections,
  isLoading = false,
}: StrategyCoachCardProps) {
  return (
    <Card variant="bordered">
      <CardHeader>
        <CardTitle>Strategy Coach</CardTitle>
        {strategyName ? (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Active: <span className="font-medium">{strategyName}</span>
          </p>
        ) : null}
        {subtitle ? (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{subtitle}</p>
        ) : null}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Loading strategy explanation...
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
                    Example: {section.example}
                  </p>
                ) : null}
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
