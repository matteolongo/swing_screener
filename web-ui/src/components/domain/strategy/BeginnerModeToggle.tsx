/**
 * Beginner Mode Toggle Component
 * Allows users to switch between beginner-friendly and advanced configuration modes
 */
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';

interface BeginnerModeToggleProps {
  isBeginnerMode: boolean;
  onToggle: (enabled: boolean) => void;
}

export default function BeginnerModeToggle({ isBeginnerMode, onToggle }: BeginnerModeToggleProps) {
  return (
    <Card variant="bordered" className="border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
      <CardHeader>
        <CardTitle className="text-blue-900 dark:text-blue-100">Configuration Mode</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={isBeginnerMode}
                  onChange={(e) => onToggle(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                  {isBeginnerMode ? '🎓 Beginner Mode' : '⚙️ Advanced Mode'}
                </span>
              </label>
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400">
              {isBeginnerMode ? (
                <div className="space-y-2">
                  <p className="font-medium text-green-700 dark:text-green-400">
                    ✅ Simplified configuration with smart defaults
                  </p>
                  <ul className="ml-4 space-y-1 text-xs">
                    <li>• Only essential parameters shown</li>
                    <li>• Extra guidance and explanations</li>
                    <li>• Conservative, beginner-safe defaults</li>
                    <li>• Clear warnings for risky changes</li>
                  </ul>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="font-medium text-orange-700 dark:text-orange-400">
                    ⚠️ Full control with all advanced options
                  </p>
                  <ul className="ml-4 space-y-1 text-xs">
                    <li>• All parameters available</li>
                    <li>• Regime scaling and fine-tuning</li>
                    <li>• Requires experience to use safely</li>
                    <li>• Easy to create risky configurations</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
