import type { ReactNode } from 'react';

interface SectionProps {
  title: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  className?: string;
}

export function Section({ title, children, description, className }: SectionProps) {
  return (
    <section className={`space-y-4 ${className ?? ''}`.trim()}>
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
