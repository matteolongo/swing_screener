import { useEffect, useState } from 'react';
import { useSymbolNote, useUpsertSymbolNoteMutation, useDeleteSymbolNoteMutation } from '@/features/symbolNotes/hooks';

interface SymbolNoteWidgetProps {
  ticker: string;
}

export default function SymbolNoteWidget({ ticker }: SymbolNoteWidgetProps) {
  const noteQuery = useSymbolNote(ticker);
  const upsertMutation = useUpsertSymbolNoteMutation();
  const deleteMutation = useDeleteSymbolNoteMutation();

  const [draft, setDraft] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  // Sync draft from query data when ticker changes or data loads
  useEffect(() => {
    setDraft(noteQuery.data?.note ?? '');
  }, [noteQuery.data, ticker]);

  const existingNote = noteQuery.data;

  const handleSave = () => {
    if (!draft.trim()) return;
    upsertMutation.mutate({ ticker, note: draft });
  };

  const handleClear = () => {
    deleteMutation.mutate(ticker);
    setDraft('');
  };

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40">
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="flex w-full items-center justify-between py-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <span>Notes for {ticker}</span>
        <span>{isExpanded ? '▲' : '▼'}</span>
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-1.5 border-t border-slate-200 pt-2 dark:border-gray-700">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder={`Write your notes for ${ticker}...`}
            className="w-full text-xs px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <div className="flex items-center justify-between gap-2">
            {existingNote?.updated_at ? (
              <span className="text-[10px] text-gray-400">
                Saved {new Date(existingNote.updated_at).toLocaleDateString()}
              </span>
            ) : (
              <span />
            )}
            <div className="flex gap-1.5">
              {existingNote && (
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={deleteMutation.isPending}
                  className="text-[10px] text-gray-400 hover:text-rose-500 transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={upsertMutation.isPending || !draft.trim()}
                className="text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {upsertMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
          {upsertMutation.isSuccess && (
            <p className="text-[10px] text-emerald-600">Saved.</p>
          )}
        </div>
      )}
    </div>
  );
}
