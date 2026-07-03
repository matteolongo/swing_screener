import { useState, type FormEvent } from 'react';

import Button from '@/components/common/Button';
import { useIntelligenceChatQuery, useSendIntelligenceChatMutation } from '@/features/intelligence/hooks';
import type { SymbolIntelligence } from '@/features/intelligence/types';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import type { PositionWithMetrics } from '@/features/portfolio/api';
import { t } from '@/i18n/t';

interface IntelligenceChatPanelProps {
  ticker: string;
  intelligence: SymbolIntelligence | null;
  candidate?: SymbolAnalysisCandidate | null;
  position?: PositionWithMetrics | null;
}

export default function IntelligenceChatPanel({
  ticker,
  intelligence,
  candidate = null,
  position = null,
}: IntelligenceChatPanelProps) {
  const [message, setMessage] = useState('');
  const [refreshSources, setRefreshSources] = useState(false);
  const chatQuery = useIntelligenceChatQuery(ticker, Boolean(intelligence));
  const sendMutation = useSendIntelligenceChatMutation(ticker);
  const disabled = !intelligence;
  const messages = chatQuery.data?.messages ?? [];

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || disabled || sendMutation.isPending) return;
    sendMutation.mutate({
      message: trimmed,
      refreshSources,
      analysisGeneratedAt: intelligence?.generatedAt ?? null,
      candidate: candidate ? { ...candidate } : null,
      position: position ? { ...position } : null,
    });
    setMessage('');
  };

  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-3 py-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t('workspacePage.panels.analysis.intelligence.chat.title')}
          </p>
          <p className="mt-1 text-xs text-muted">
            {disabled
              ? t('workspacePage.panels.analysis.intelligence.chat.disabled')
              : t('workspacePage.panels.analysis.intelligence.chat.persistedToday', { ticker })}
          </p>
        </div>
        <span className="text-xs text-muted">
          {t('workspacePage.panels.analysis.intelligence.chat.advisoryOnly')}
        </span>
      </div>

      <div className="max-h-72 min-h-36 overflow-y-auto px-3 py-3">
        {chatQuery.isLoading ? (
          <p className="text-sm text-muted">{t('workspacePage.panels.analysis.intelligence.timeline.loading')}</p>
        ) : chatQuery.isError ? (
          <p className="text-sm text-danger">
            {chatQuery.error instanceof Error
              ? chatQuery.error.message
              : t('workspacePage.panels.analysis.intelligence.chat.loadError')}
          </p>
        ) : messages.length > 0 ? (
          <div className="grid gap-2">
            {messages.map((item) => {
              const isAssistant = item.role === 'assistant';
              return (
                <div
                  key={item.id}
                  className={`max-w-[82%] rounded-xl border px-3 py-2 text-sm ${
                    isAssistant
                      ? 'justify-self-end border-primary/30 bg-primary/10 text-foreground'
                      : 'border-border bg-surface text-foreground'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{item.content}</p>
                  {isAssistant && item.evidenceUsed.length > 0 && (
                    <details className="mt-2 rounded-lg border border-border bg-surface/80 px-2 py-1">
                      <summary className="cursor-pointer text-xs font-medium text-muted">
                        {t('workspacePage.panels.analysis.intelligence.chat.evidenceUsed')}
                      </summary>
                      <div className="mt-2 grid gap-2">
                        {item.evidenceUsed.map((evidence) => (
                          <div key={`${item.id}-${evidence.label}-${evidence.url ?? ''}`} className="text-xs text-muted">
                            {evidence.url ? (
                              <a href={evidence.url} target="_blank" rel="noreferrer" className="text-foreground underline">
                                {evidence.label}
                              </a>
                            ) : (
                              <span className="text-foreground">{evidence.label}</span>
                            )}
                            <span>
                              {' '}
                              {[
                                evidence.source,
                                evidence.date,
                              ].filter(Boolean).join(' · ')}
                            </span>
                            {evidence.summary && <p className="mt-1">{evidence.summary}</p>}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted">
            {disabled
              ? t('workspacePage.panels.analysis.intelligence.chat.disabled')
              : t('workspacePage.panels.analysis.intelligence.chat.empty')}
          </p>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="sticky bottom-0 rounded-b-lg border-t border-border bg-surface/95 px-3 py-2 backdrop-blur"
      >
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={refreshSources}
            disabled={disabled || sendMutation.isPending}
            onChange={(event) => setRefreshSources(event.target.checked)}
          />
          {t('workspacePage.panels.analysis.intelligence.chat.refreshSources')}
        </label>
        <div className="mt-2 flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-50"
            value={message}
            disabled={disabled || sendMutation.isPending}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t('workspacePage.panels.analysis.intelligence.chat.placeholder', { ticker })}
          />
          <Button type="submit" size="sm" disabled={disabled || sendMutation.isPending || !message.trim()}>
            {sendMutation.isPending
              ? t('workspacePage.panels.analysis.intelligence.chat.sending')
              : t('workspacePage.panels.analysis.intelligence.chat.send')}
          </Button>
        </div>
        {sendMutation.isError && (
          <p className="mt-2 text-xs text-danger">
            {sendMutation.error instanceof Error
              ? sendMutation.error.message
              : t('workspacePage.panels.analysis.intelligence.chat.sendError')}
          </p>
        )}
      </form>
    </section>
  );
}
