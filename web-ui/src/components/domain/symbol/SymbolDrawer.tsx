import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import Drawer from '@/components/common/Drawer';
import SymbolAnalysisContent from '@/components/domain/workspace/SymbolAnalysisContent';
import ActionPanel from '@/components/domain/workspace/ActionPanel';
import { useSymbolFundamentalsSync } from '@/features/fundamentals/useSymbolFundamentalsSync';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useScreenerStore } from '@/stores/screenerStore';
import { useOpenPositions } from '@/features/portfolio/hooks';
import { t } from '@/i18n/t';

export default function SymbolDrawer() {
  const ticker = useWorkspaceStore((s) => s.selectedTicker);
  const analysisTab = useWorkspaceStore((s) => s.analysisTab);
  const setAnalysisTab = useWorkspaceStore((s) => s.setAnalysisTab);
  const clearSelectedTicker = useWorkspaceStore((s) => s.clearSelectedTicker);

  const candidate = useScreenerStore((s) =>
    ticker ? (s.lastResult?.candidates.find((c) => c.ticker === ticker) ?? null) : null
  );
  const positionsQuery = useOpenPositions();
  const position = ticker
    ? (positionsQuery.data?.find((p) => p.ticker === ticker) ?? null)
    : null;

  useSymbolFundamentalsSync(ticker, candidate);

  return (
    <Drawer
      open={Boolean(ticker)}
      onClose={clearSelectedTicker}
      widthClassName="w-[880px]"
      title={ticker ? (
        <span className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
          {ticker}
          <Link
            to={`/symbol/${ticker}`}
            onClick={clearSelectedTicker}
            aria-label={t('symbolDrawer.openFull')}
            className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-foreground/5 hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </span>
      ) : null}
    >
      {ticker && (
        <div className="p-4">
          <SymbolAnalysisContent
            ticker={ticker}
            candidate={candidate}
            position={position}
            activeTab={analysisTab}
            onTabChange={setAnalysisTab}
            orderPanel={<ActionPanel ticker={ticker} />}
          />
        </div>
      )}
    </Drawer>
  );
}
