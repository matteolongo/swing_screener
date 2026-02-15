/**
 * StrategySafetyScore - Displays the safety score for the current strategy configuration
 * Provides visual feedback on configuration risk level
 */
import { useMemo } from 'react';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import type { Strategy } from '@/features/strategy/types';
import { calculateSafetyScore, getSafetyLevel, evaluateStrategy } from '@/utils/strategySafety';

interface StrategySafetyScoreProps {
  strategy: Strategy;
}

export default function StrategySafetyScore({ strategy }: StrategySafetyScoreProps) {
  const score = useMemo(() => calculateSafetyScore(strategy), [strategy]);
  const level = useMemo(() => getSafetyLevel(score), [score]);
  const warnings = useMemo(() => evaluateStrategy(strategy), [strategy]);

  const levelConfig = {
    'beginner-safe': {
      color: 'text-green-700 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      borderColor: 'border-green-300 dark:border-green-700',
      icon: '🟢',
      label: 'Beginner Safe',
      message: 'This configuration follows conservative best practices.',
    },
    'requires-discipline': {
      color: 'text-yellow-700 dark:text-yellow-400',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
      borderColor: 'border-yellow-300 dark:border-yellow-700',
      icon: '🟡',
      label: 'Requires Discipline',
      message: 'This configuration requires consistent execution and emotional control.',
    },
    'expert-only': {
      color: 'text-red-700 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      borderColor: 'border-red-300 dark:border-red-700',
      icon: '🔴',
      label: 'Expert Only',
      message: 'This configuration has elevated risk. Only use with extensive experience.',
    },
  };

  const config = levelConfig[level];
  const dangerWarnings = warnings.filter((w) => w.level === 'danger');
  const regularWarnings = warnings.filter((w) => w.level === 'warning');

  return (
    <Card variant="bordered" className={`${config.borderColor} ${config.bgColor}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className={config.color}>Strategy Safety Score</span>
          <span className="text-2xl font-bold">{score} / 100</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className={`flex items-center gap-3 p-3 rounded-lg border ${config.borderColor} bg-white dark:bg-gray-800`}>
            <span className="text-3xl">{config.icon}</span>
            <div className="flex-1">
              <div className={`font-bold text-lg ${config.color}`}>{config.label}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {config.message}
              </div>
            </div>
          </div>

          {dangerWarnings.length > 0 && (
            <div className="space-y-2">
              <div className="font-semibold text-sm text-red-700 dark:text-red-400">
                Critical Issues ({dangerWarnings.length}):
              </div>
              {dangerWarnings.map((warning, idx) => (
                <div key={idx} className="text-sm text-red-600 dark:text-red-400 pl-4">
                  • {warning.message}
                </div>
              ))}
            </div>
          )}

          {regularWarnings.length > 0 && (
            <div className="space-y-2">
              <div className="font-semibold text-sm text-yellow-700 dark:text-yellow-400">
                Considerations ({regularWarnings.length}):
              </div>
              {regularWarnings.map((warning, idx) => (
                <div key={idx} className="text-sm text-yellow-600 dark:text-yellow-400 pl-4">
                  • {warning.message}
                </div>
              ))}
            </div>
          )}

          {warnings.length === 0 && (
            <div className="text-sm text-green-700 dark:text-green-400">
              ✅ All parameters are within recommended ranges.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
