import PortfolioPanel from '@/components/domain/workspace/PortfolioPanel';
import PortfolioRiskSummary from '@/components/domain/portfolio/PortfolioRiskSummary';
import { usePositions } from '@/features/portfolio/hooks';
import { useActiveStrategyQuery } from '@/features/strategy/hooks';

export default function Portfolio() {
  const openPositionsQuery = usePositions('open');
  const activeStrategyQuery = useActiveStrategyQuery();

  const openPositions = openPositionsQuery.data ?? [];
  const accountSize = activeStrategyQuery.data?.risk?.accountSize;

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 px-4 py-4">
      <PortfolioRiskSummary openPositions={openPositions} accountSize={accountSize} />
      <PortfolioPanel />
    </div>
  );
}
