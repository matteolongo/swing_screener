/**
 * User Mode Toggle Component
 * Allows users to switch between beginner and advanced modes globally
 * Synchronized with the sidebar toggle via beginnerModeStore
 */
import { GraduationCap, Settings } from 'lucide-react';
import { useBeginnerModeStore } from '@/stores/beginnerModeStore';

export default function UserModeToggle() {
  const { isBeginnerMode, toggleBeginnerMode } = useBeginnerModeStore();

  return (
    <button
      onClick={toggleBeginnerMode}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      title={isBeginnerMode ? 'Switch to Advanced Mode' : 'Switch to Beginner Mode'}
    >
      {isBeginnerMode ? (
        <>
          <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Beginner</span>
        </>
      ) : (
        <>
          <Settings className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Advanced</span>
        </>
      )}
    </button>
  );
}
