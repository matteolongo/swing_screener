import { cn } from '@/utils/cn';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  badge?: number | string;
}

interface TabsProps<T extends string> {
  tabs: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}

export default function Tabs<T extends string>({ tabs, active, onChange, className }: TabsProps<T>) {
  return (
    <div role="tablist" className={cn('flex items-center gap-1 border-b border-border', className)}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative -mb-px flex h-9 items-center gap-1.5 border-b-2 px-3 text-[13px] font-medium transition-colors',
              isActive
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted hover:text-foreground'
            )}
          >
            {tab.label}
            {tab.badge != null && (
              <span className="rounded-full bg-foreground/10 px-1.5 text-[11px] leading-4 text-muted">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
