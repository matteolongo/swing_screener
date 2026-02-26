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
      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-gray-300 px-2.5 py-2 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 sm:px-3"
      title={isBeginnerMode ? 'Switch to Advanced Mode' : 'Switch to Beginner Mode'}
      aria-label={isBeginnerMode ? 'Switch to Advanced Mode' : 'Switch to Beginner Mode'}
    >
      {isBeginnerMode ? (
        <>
          <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="hidden text-sm font-medium text-gray-700 dark:text-gray-300 sm:inline">Beginner</span>
        </>
      ) : (
        <>
          <Settings className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          <span className="hidden text-sm font-medium text-gray-700 dark:text-gray-300 sm:inline">Advanced</span>
        </>
      )}
    </button>
  );
}
