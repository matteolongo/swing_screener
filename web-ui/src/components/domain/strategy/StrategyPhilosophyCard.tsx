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
    <Card variant="bordered" className="border-primary/40 bg-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <span className="text-2xl">🎯</span>
          {strategyInfo.name} — How It Thinks
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-base text-foreground leading-relaxed">
            {strategyInfo.philosophy}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <div className="font-semibold text-muted">
                Ideal for:
              </div>
              <div className="text-muted">
                {strategyInfo.idealFor}
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="font-semibold text-muted">
                Typical holding time:
              </div>
              <div className="text-muted">
                {strategyInfo.holdingPeriod}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-primary/40">
            <p className="text-sm font-medium text-primary italic">
              💡 Core Rule: {strategyInfo.coreRule}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
