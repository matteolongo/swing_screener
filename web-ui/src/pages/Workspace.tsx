import { useState } from 'react';
import AnalysisCanvasPanel from '@/components/domain/workspace/AnalysisCanvasPanel';
import FloatingChatWidget from '@/components/domain/workspace/FloatingChatWidget';
import ScreenerInboxPanel from '@/components/domain/workspace/ScreenerInboxPanel';
import { useSymbolIntelligenceRunner } from '@/features/intelligence/useSymbolIntelligenceRunner';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { cn } from '@/utils/cn';

export default function Workspace() {
  const selectedTicker = useWorkspaceStore((state) => state.selectedTicker);
  const { runForTicker, getStatusForTicker } = useSymbolIntelligenceRunner();
  const selectedTickerIntelligenceStatus = selectedTicker ? getStatusForTicker(selectedTicker) : undefined;
  const [activeTablet, setActiveTablet] = useState<'screener' | 'analysis'>('screener');

  return (
    <div className="mx-auto max-w-[1600px]">
      {/* Tablet tab switcher — only visible below xl breakpoint */}
      <div className="xl:hidden flex border-b border-border mb-3">
        <button
          type="button"
          onClick={() => setActiveTablet('screener')}
          className={cn(
            'flex-1 py-2 text-sm font-medium transition-colors',
            activeTablet === 'screener'
              ? 'border-b-2 border-primary text-primary'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
          )}
        >
          Screener
        </button>
        <button
          type="button"
          onClick={() => setActiveTablet('analysis')}
          className={cn(
            'flex-1 py-2 text-sm font-medium transition-colors',
            activeTablet === 'analysis'
              ? 'border-b-2 border-primary text-primary'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
          )}
        >
          Analysis
        </button>
      </div>

      <div className="flex gap-4 xl:h-[calc(100vh-120px)] min-h-[500px]">
        <div
          className={cn(
            'min-w-0 flex flex-col xl:overflow-hidden xl:w-7/12',
            activeTablet === 'screener' ? 'w-full' : 'hidden xl:flex'
          )}
        >
          <ScreenerInboxPanel />
        </div>
        <div
          className={cn(
            'min-w-0 flex flex-col xl:overflow-hidden xl:w-5/12',
            activeTablet === 'analysis' ? 'w-full' : 'hidden xl:flex'
          )}
        >
          <AnalysisCanvasPanel
            onRunSymbolIntelligence={runForTicker}
            symbolIntelligenceStatus={selectedTickerIntelligenceStatus}
          />
        </div>
      </div>

      <FloatingChatWidget />
    </div>
  );
}
