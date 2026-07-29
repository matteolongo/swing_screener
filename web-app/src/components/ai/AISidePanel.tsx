import { X } from 'lucide-react';
import clsx from 'clsx';
import { useAIStore } from '../../store/useAIStore';
import AnalysisView from './AnalysisView';
import ThesisView from './ThesisView';
import PlanView from './PlanView';
import { useState } from 'react';

type SubTab = 'analysis' | 'thesis' | 'plan';

export default function AISidePanel() {
  const { activeSymbol, analysisData, setActiveSymbol } = useAIStore();
  const [subTab, setSubTab] = useState<SubTab>('analysis');

  if (!activeSymbol) return null;

  const analysis = analysisData[activeSymbol];

  const subTabs: { id: SubTab; label: string }[] = [
    { id: 'analysis', label: 'Analysis' },
    { id: 'thesis', label: 'Thesis' },
    { id: 'plan', label: 'Plan' },
  ];

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => setActiveSymbol(null)}
      />
      <aside className="fixed right-0 top-0 h-full w-[480px] bg-[var(--bg-elevated)] shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            {activeSymbol}
          </h2>
          <button
            onClick={() => setActiveSymbol(null)}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex border-b border-[var(--border)]">
          {subTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={clsx(
                'flex-1 py-2.5 text-xs font-medium transition-colors',
                subTab === t.id
                  ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!analysis ? (
            <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
              Loading analysis...
            </div>
          ) : subTab === 'analysis' ? (
            <AnalysisView analysis={analysis} />
          ) : subTab === 'thesis' ? (
            <ThesisView analysis={analysis} />
          ) : (
            <PlanView analysis={analysis} />
          )}
        </div>
      </aside>
    </>
  );
}
