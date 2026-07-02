import { NavLink, Outlet } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';

const tabs = [
  { to: '/system/pool', label: () => t('system.tabs.pool') },
  { to: '/system/datasources', label: () => t('system.tabs.datasources') },
  { to: '/system/strategy', label: () => t('system.tabs.strategy') },
];

export default function System() {
  return (
    <div>
      <PageHeader title={t('system.title')} subtitle={t('system.subtitle')} />
      <nav className="mb-4 flex items-center gap-1 border-b border-border" aria-label={t('system.title')}>
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                'relative -mb-px flex h-9 items-center border-b-2 px-3 text-[13px] font-medium transition-colors',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted hover:text-foreground'
              )
            }
          >
            {tab.label()}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
