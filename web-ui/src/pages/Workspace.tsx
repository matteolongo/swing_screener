import { useEffect, useRef, useState } from 'react';
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
  const prevTickerRef = useRef<string | null>(null);

  // On narrow screens, auto-switch to analysis panel when a symbol is selected
  useEffect(() => {
    if (selectedTicker && selectedTicker !== prevTickerRef.current) {
      prevTickerRef.current = selectedTicker;
      setActiveTablet('analysis');
    }
  }, [selectedTicker]);

  return (
    <div className="mx-auto max-w-[1600px]">
      {/* Tablet tab switcher — only visible below xl breakpoint */}
      <div className="xl:hidden flex border-b border-border mb-3">
        {(['screener', 'analysis'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTablet(tab)}
            className={cn(
              'flex-1 py-2 text-sm font-medium capitalize transition-colors',
              activeTablet === tab
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            )}
          >
            {tab}
          </button>
        ))}
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
