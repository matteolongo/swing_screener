import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { Send } from 'lucide-react';
import type { ChatMessage } from '../../store/useAIStore';
import { useI18n } from '../../i18n';

interface Props {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatPanel({ messages, onSend, disabled }: Props) {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto space-y-3 px-1 py-2"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-xs">
            <div className="text-center">
              <p className="mb-1">{t('chatPanel.empty')}</p>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={clsx(
                'flex',
                msg.role === 'user' ? 'justify-end' : 'justify-start',
              )}
            >
              <div
                className={clsx(
                  'max-w-[85%] rounded-lg px-3 py-2 text-xs',
                  msg.role === 'user'
                    ? 'bg-[var(--accent)] text-white rounded-br-sm'
                    : 'bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-bl-sm border border-[var(--border)]',
                )}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.role === 'assistant' && msg.evidence_used && msg.evidence_used.length > 0 && (
                  <details className="mt-1.5">
                    <summary className="text-[10px] text-[var(--text-secondary)] cursor-pointer hover:text-[var(--accent)]">
                      {t('chatPanel.evidenceUsed')} ({msg.evidence_used.length})
                    </summary>
                    <ul className="mt-1 space-y-0.5">
                      {msg.evidence_used.map((ev, j) => (
                        <li key={j} className="text-[10px] text-[var(--text-secondary)]">• {ev}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--border)] pt-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('chatPanel.inputPlaceholder')}
          disabled={disabled}
          className="flex-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className="flex items-center gap-1 px-3 py-2 rounded bg-[var(--accent)] text-white text-xs font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send size={14} />
          {t('chatPanel.send')}
        </button>
      </div>
    </div>
  );
}
