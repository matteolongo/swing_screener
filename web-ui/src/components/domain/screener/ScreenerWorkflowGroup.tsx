import type { ReactNode } from 'react';
import { t } from '@/i18n/t';
import type { WorkflowPresentation } from '@/components/domain/recommendation/workflowPresentation';
import { cn } from '@/utils/cn';

interface ScreenerWorkflowGroupProps {
  presentation: WorkflowPresentation;
  count: number;
  defaultOpen: boolean;
  children: ReactNode;
}

const DOT_STYLES = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  neutral: 'bg-muted',
} as const;

export default function ScreenerWorkflowGroup({ presentation, count, defaultOpen, children }: ScreenerWorkflowGroupProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <details open={defaultOpen}>
        <summary className="cursor-pointer list-none bg-foreground/5 px-4 py-3">
          <h3
            aria-label={t(presentation.groupTitleKey)}
            className="flex w-full items-center gap-3"
          >
            <span className={cn('h-2.5 w-2.5 rounded-full', DOT_STYLES[presentation.tone])} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">{t(presentation.groupTitleKey)}</span>
              <span className="block text-xs font-normal text-muted">{t(presentation.groupDescriptionKey)}</span>
            </span>
            <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-semibold text-muted">{count}</span>
          </h3>
        </summary>
        {children}
      </details>
    </section>
  );
}
