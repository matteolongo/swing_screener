import { FormEvent, useState } from 'react';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import Card from '@/components/common/Card';
import { useWorkspaceChatMutation } from '@/features/chat/hooks';
import { buildWorkspaceSnapshot, ChatTurn, WorkspaceContextSourceMeta } from '@/features/chat/types';
import { t } from '@/i18n/t';
import { useScreenerStore } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { cn } from '@/utils/cn';

interface WorkspaceChatPanelProps {
  embedded?: boolean;
}

function sourceBadgeVariant(source: WorkspaceContextSourceMeta): 'success' | 'warning' | 'primary' {
  if (!source.loaded) {
    return 'warning';
  }
  if (source.source === 'portfolio') {
    return 'success';
  }
  return 'primary';
}

function sourceBadgeLabel(source: WorkspaceContextSourceMeta): string {
  return `${source.label} ${source.loaded ? t('workspacePage.panels.chat.badges.ready') : t('workspacePage.panels.chat.badges.missing')}`;
}

function messageBubbleClass(role: ChatTurn['role']): string {
  return role === 'user'
    ? 'ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-blue-600 px-3 py-2 text-sm text-white'
    : 'mr-auto max-w-[92%] rounded-2xl rounded-bl-md bg-gray-100 px-3 py-2 text-sm text-gray-900 dark:bg-gray-700 dark:text-gray-100';
}

export default function WorkspaceChatPanel({ embedded = false }: WorkspaceChatPanelProps) {
  const selectedTicker = useWorkspaceStore((state) => state.selectedTicker);
  const lastResult = useScreenerStore((state) => state.lastResult);
  const [draft, setDraft] = useState('');
  const [conversation, setConversation] = useState<ChatTurn[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [factsUsed, setFactsUsed] = useState<string[]>([]);
  const [sources, setSources] = useState<WorkspaceContextSourceMeta[]>([]);
  const chatMutation = useWorkspaceChatMutation();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = draft.trim();
    if (!question || chatMutation.isPending) {
      return;
    }

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
      // Mutation state already captures the error for rendering.
    }
  };

  const containerClassName = cn(
    'flex flex-col gap-3',
    embedded ? 'rounded-lg border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-900/30' : 'p-4 md:p-5 xl:min-h-[280px]'
  );
  const content = (
    <div className={containerClassName}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t('workspacePage.panels.chat.title')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('workspacePage.panels.chat.description')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span>
          {t('workspacePage.panels.chat.focusTicker', {
            ticker: selectedTicker || t('workspacePage.panels.chat.noneSelected'),
          })}
        </span>
        <span>
          {t('workspacePage.panels.chat.snapshotStatus', {
            count: lastResult?.candidates.length ?? 0,
          })}
        </span>
      </div>

      {sources.length > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label={t('workspacePage.panels.chat.contextBadgesAria')}>
          {sources.map((source) => (
            <Badge key={source.source} variant={sourceBadgeVariant(source)}>
              {sourceBadgeLabel(source)}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="min-h-[160px] rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/50">
        {conversation.length === 0 && !chatMutation.isPending ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">
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
          </div>
        )}
      </div>

      {factsUsed.length > 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t('workspacePage.panels.chat.factsUsed', { facts: factsUsed.join(', ') })}
        </p>
      ) : null}

      {warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          {warnings.map((warning, index) => (
            <p key={`${warning}-${index}`}>{warning}</p>
          ))}
        </div>
      ) : null}

      {chatMutation.isError ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
          role="alert"
        >
          {(chatMutation.error as Error).message || t('workspacePage.panels.chat.error')}
        </div>
      ) : null}

      <form className="space-y-2" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="workspace-chat-input">
          {t('workspacePage.panels.chat.inputLabel')}
        </label>
        <textarea
          id="workspace-chat-input"
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t('workspacePage.panels.chat.placeholder')}
          className={cn(
            'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900',
            'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200',
            'dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:ring-blue-900'
          )}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('workspacePage.panels.chat.readOnlyNote')}
          </p>
          <Button type="submit" size="sm" disabled={chatMutation.isPending || draft.trim().length === 0}>
            {chatMutation.isPending ? t('workspacePage.panels.chat.submitLoading') : t('workspacePage.panels.chat.submit')}
          </Button>
        </div>
      </form>
    </div>
  );

  if (embedded) {
    return content;
  }

  return <Card variant="bordered" className="xl:h-full">{content}</Card>;
}
