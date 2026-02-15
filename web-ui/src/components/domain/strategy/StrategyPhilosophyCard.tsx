/**
 * StrategyPhilosophyCard - Displays strategy intent and philosophy at the top of the Strategy page
 * This helps users understand WHY before they configure WHAT
 */
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import type { StrategyInfo } from '@/content/strategy_docs/types';

interface StrategyPhilosophyCardProps {
  strategyInfo: StrategyInfo;
}

export default function StrategyPhilosophyCard({ strategyInfo }: StrategyPhilosophyCardProps) {
  return (
    <Card variant="bordered" className="border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
          <span className="text-2xl">🎯</span>
          {strategyInfo.name} — How It Thinks
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-base text-gray-800 dark:text-gray-200 leading-relaxed">
            {strategyInfo.philosophy}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <div className="font-semibold text-gray-700 dark:text-gray-300">
                Ideal for:
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                {strategyInfo.idealFor}
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="font-semibold text-gray-700 dark:text-gray-300">
                Typical holding time:
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                {strategyInfo.holdingPeriod}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 italic">
              💡 Core Rule: {strategyInfo.coreRule}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
