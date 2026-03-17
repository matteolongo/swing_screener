import { FormEvent, useEffect, useRef, useState } from 'react';
import { MessageCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import { useWorkspaceChatMutation } from '@/features/chat/hooks';
import { buildWorkspaceSnapshot, ChatTurn, WorkspaceContextSourceMeta } from '@/features/chat/types';
import { t } from '@/i18n/t';
import { useScreenerStore } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { cn } from '@/utils/cn';
import { formatCurrency } from '@/utils/formatters';

function sourceBadgeVariant(source: WorkspaceContextSourceMeta): 'success' | 'warning' | 'primary' {
  if (!source.loaded) return 'warning';
  if (source.source === 'portfolio') return 'success';
  return 'primary';
}

function messageBubbleClass(role: ChatTurn['role']): string {
  return role === 'user'
    ? 'ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-blue-600 px-3 py-2 text-sm text-white'
    : 'mr-auto max-w-[92%] rounded-2xl rounded-bl-md bg-gray-100 px-3 py-2 text-sm text-gray-900 dark:bg-gray-700 dark:text-gray-100';
}

export default function FloatingChatWidget() {
  const selectedTicker = useWorkspaceStore((state) => state.selectedTicker);
  const lastResult = useScreenerStore((state) => state.lastResult);

  const [isOpen, setIsOpen] = useState(false);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [conversation, setConversation] = useState<ChatTurn[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [factsUsed, setFactsUsed] = useState<string[]>([]);
  const [sources, setSources] = useState<WorkspaceContextSourceMeta[]>([]);

  const chatMutation = useWorkspaceChatMutation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when conversation updates
  useEffect(() => {
    if (isOpen && messagesEndRef.current?.scrollIntoView) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation, chatMutation.isPending, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const candidate = lastResult?.candidates.find(
    (c) => c.ticker.toUpperCase() === (selectedTicker ?? '').toUpperCase()
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = draft.trim();
    if (!question || chatMutation.isPending) return;

    try {
      const response = await chatMutation.mutateAsync({
        question,
        conversation,
        selectedTicker: selectedTicker ?? undefined,
        workspaceSnapshot: buildWorkspaceSnapshot(lastResult),
      });
      setConversation(response.conversationState);
      setWarnings(response.warnings);
      setFactsUsed(response.factsUsed);
      setSources(response.contextMeta.sources);
      setDraft('');
    } catch {
      // error captured in mutation state
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Chat panel */}
      {isOpen ? (
        <div
          className={cn(
            'flex flex-col w-[360px] sm:w-[400px] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700',
            'bg-white dark:bg-gray-900',
            'max-h-[min(580px,calc(100vh-120px))]'
          )}
          role="dialog"
          aria-label={t('workspacePage.panels.chat.title')}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <MessageCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                {t('workspacePage.panels.chat.title')}
              </span>
              {selectedTicker ? (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 flex-shrink-0">
                  {selectedTicker}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 flex-shrink-0"
              aria-label={t('workspacePage.panels.chat.floating.closeAria')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Context panel (collapsible) */}
          <div className="border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsContextOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <span>{t('workspacePage.panels.chat.floating.contextTitle')}</span>
              {isContextOpen
                ? <ChevronUp className="h-3.5 w-3.5" />
                : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {isContextOpen ? (
              <div className="px-4 pb-3 space-y-2">
                {/* Selected symbol */}
                <div className="text-xs space-y-1">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {t('workspacePage.panels.chat.floating.contextTicker')}:{' '}
                  </span>
                  <span className="text-gray-900 dark:text-gray-100 font-mono">
                    {selectedTicker ?? t('workspacePage.panels.chat.floating.contextNoTicker')}
                  </span>
                </div>

                {/* Candidate data */}
                {selectedTicker ? (
                  candidate ? (
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('workspacePage.panels.chat.floating.contextCandidateRank')}</span>
                        <span className="font-mono">#{candidate.rank}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('workspacePage.panels.chat.floating.contextCandidateSignal')}</span>
                        <span className="font-mono">{candidate.signal ?? '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('workspacePage.panels.chat.floating.contextCandidateEntry')}</span>
                        <span className="font-mono">{candidate.entry != null ? formatCurrency(candidate.entry, candidate.currency) : '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('workspacePage.panels.chat.floating.contextCandidateStop')}</span>
                        <span className="font-mono">{candidate.stop != null ? formatCurrency(candidate.stop, candidate.currency) : '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('workspacePage.panels.chat.floating.contextCandidateRR')}</span>
                        <span className="font-mono">{candidate.rr != null ? candidate.rr.toFixed(2) : '—'}</span>
                      </div>
                      {candidate.recommendation?.verdict ? (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Verdict</span>
                          <span className={cn(
                            'font-medium',
                            candidate.recommendation.verdict === 'RECOMMENDED'
                              ? 'text-green-700 dark:text-green-400'
                              : 'text-amber-700 dark:text-amber-400'
                          )}>
                            {candidate.recommendation.verdict === 'RECOMMENDED' ? 'Recommended' : 'Not recommended'}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">{t('workspacePage.panels.chat.floating.contextNoCandidate')}</p>
                  )
                ) : null}

                {/* Source badges after first response — context panel only */}
                {sources.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5" aria-label={t('workspacePage.panels.chat.contextBadgesAria')}>
                    {sources.map((source) => (
                      <Badge key={source.source} variant={sourceBadgeVariant(source)} className="text-xs">
                        {source.label} {source.loaded ? t('workspacePage.panels.chat.badges.ready') : t('workspacePage.panels.chat.badges.missing')}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {t('workspacePage.panels.chat.snapshotStatus', { count: lastResult?.candidates.length ?? 0 })}
                  </p>
                )}
              </div>
            ) : null}
          </div>

          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
            {conversation.length === 0 && !chatMutation.isPending ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-4">
                {t('workspacePage.panels.chat.empty')}
              </p>
            ) : (
              <div className="flex flex-col gap-2" aria-live="polite">
                {conversation.map((turn, index) => (
                  <div key={`${turn.role}-${index}`} className={messageBubbleClass(turn.role)}>
                    {turn.content}
                  </div>
                ))}
                {chatMutation.isPending ? (
                  <div className={messageBubbleClass('assistant')}>
                    {t('workspacePage.panels.chat.loading')}
                  </div>
                ) : null}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Source badges (shown below messages after first response) */}
          {sources.length > 0 ? (
            <div className="px-4 pb-1 flex-shrink-0">
              <div className="flex flex-wrap gap-1.5" aria-label={t('workspacePage.panels.chat.contextBadgesAria')}>
                {sources.map((source) => (
                  <Badge key={source.source} variant={sourceBadgeVariant(source)} className="text-xs">
                    {source.label} {source.loaded ? t('workspacePage.panels.chat.badges.ready') : t('workspacePage.panels.chat.badges.missing')}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {/* Facts used */}
          {factsUsed.length > 0 ? (
            <div className="px-4 pb-1 flex-shrink-0">
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                {t('workspacePage.panels.chat.factsUsed', { facts: factsUsed.join(', ') })}
              </p>
            </div>
          ) : null}

          {/* Warnings */}
          {warnings.length > 0 ? (
            <div className="mx-4 mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300 flex-shrink-0">
              {warnings.map((w, i) => <p key={i}>{w}</p>)}
            </div>
          ) : null}

          {/* Error */}
          {chatMutation.isError ? (
            <div className="mx-4 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 flex-shrink-0" role="alert">
              {(chatMutation.error as Error).message || t('workspacePage.panels.chat.error')}
            </div>
          ) : null}

          {/* Input */}
          <form
            className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-800 flex-shrink-0"
            onSubmit={handleSubmit}
          >
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('workspacePage.panels.chat.placeholder')}
                aria-label={t('workspacePage.panels.chat.inputLabel')}
                className={cn(
                  'flex-1 resize-none rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900',
                  'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200',
                  'dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:ring-blue-900'
                )}
              />
              <Button
                type="submit"
                size="sm"
                disabled={chatMutation.isPending || draft.trim().length === 0}
                className="flex-shrink-0"
              >
                {chatMutation.isPending ? '…' : t('workspacePage.panels.chat.submit')}
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
              {t('workspacePage.panels.chat.readOnlyNote')}
            </p>
          </form>
        </div>
      ) : null}

      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? t('workspacePage.panels.chat.floating.closeAria') : t('workspacePage.panels.chat.floating.openAria')}
        className={cn(
          'flex items-center gap-2 rounded-full px-4 py-3 shadow-lg transition-all',
          'bg-blue-600 text-white hover:bg-blue-700 active:scale-95',
          'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2'
        )}
      >
        <MessageCircle className="h-5 w-5 flex-shrink-0" />
        {!isOpen && selectedTicker ? (
          <span className="text-sm font-medium">{selectedTicker}</span>
        ) : null}
        {conversation.length > 0 && !isOpen ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-blue-600">
            {conversation.filter((t) => t.role === 'assistant').length}
          </span>
        ) : null}
      </button>
    </div>
  );
}
