import { Settings } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export default function ProfileMenu() {
  const toggleDrawer = useAppStore((s) => s.toggleDrawer);

  return (
    <button
      onClick={toggleDrawer}
      className="p-2 rounded text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
      title="Settings"
    >
      <Settings size={16} />
    </button>
  );
}
