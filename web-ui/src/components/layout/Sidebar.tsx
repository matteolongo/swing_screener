import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Search, 
  BarChart3,
  FileText, 
  TrendingUp, 
  Settings 
} from 'lucide-react';
import { cn } from '@/utils/cn';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Screener', href: '/screener', icon: Search },
  { name: 'Backtest', href: '/backtest', icon: BarChart3 },
  { name: 'Orders', href: '/orders', icon: FileText },
  { name: 'Positions', href: '/positions', icon: TrendingUp },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="w-64 border-r border-border bg-white dark:bg-gray-800 flex flex-col">
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>
      
      <div className="p-4 border-t border-border text-xs text-gray-500">
        <p>v0.1.0</p>
        <p className="mt-1">Risk-first swing trading</p>
      </div>
    </aside>
  );
}
