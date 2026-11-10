import type { ReactNode } from 'react';

export default function WorkspaceIntro({ label, title, description, action }: {
  label: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="workspace-intro flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-border px-5 py-6 sm:px-7 sm:py-7">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{label}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted sm:text-base">{description}</p>
      </div>
      {action}
    </header>
  );
}
