/**
 * StrategySafetyScore - Displays the safety score for the current strategy configuration
 * Provides visual feedback on configuration risk level
 */
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import type { StrategyValidationResult } from '@/features/strategy/api';

interface StrategySafetyScoreProps {
  validation?: StrategyValidationResult;
  isLoading?: boolean;
  isError?: boolean;
}

export default function StrategySafetyScore({
  validation,
  isLoading = false,
  isError = false,
}: StrategySafetyScoreProps) {
  const score = validation?.safetyScore ?? 100;
  const level = validation?.safetyLevel ?? 'beginner-safe';
  const warnings = validation?.warnings ?? [];

  const levelConfig = {
    'beginner-safe': {
      color: 'text-success',
      bgColor: 'bg-success/10',
      borderColor: 'border-success/40',
      icon: '🟢',
      label: 'Beginner Safe',
      message: 'This configuration follows conservative best practices.',
    },
    'requires-discipline': {
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/40',
      icon: '🟡',
      label: 'Requires Discipline',
      message: 'This configuration requires consistent execution and emotional control.',
    },
    'expert-only': {
      color: 'text-danger',
      bgColor: 'bg-danger/10',
      borderColor: 'border-danger/40',
      icon: '🔴',
      label: 'Expert Only',
      message: 'This configuration has elevated risk. Only use with extensive experience.',
    },
  };

  const config = levelConfig[level];
  const dangerWarnings = warnings.filter((w) => w.level === 'danger');
  const regularWarnings = warnings.filter((w) => w.level === 'warning');
  const infoWarnings = warnings.filter((w) => w.level === 'info');

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
          {isLoading && (
            <div className="text-sm text-muted">
              Validating current parameters...
            </div>
          )}

          {isError && (
            <div className="text-sm text-danger">
              Validation service unavailable. Showing last known result.
            </div>
          )}

          <div className={`flex items-center gap-3 p-3 rounded-lg border ${config.borderColor} bg-surface`}>
            <span className="text-3xl">{config.icon}</span>
            <div className="flex-1">
              <div className={`font-bold text-lg ${config.color}`}>{config.label}</div>
              <div className="text-sm text-muted mt-1">
                {config.message}
              </div>
            </div>
          </div>

          {dangerWarnings.length > 0 && (
            <div className="space-y-2">
              <div className="font-semibold text-sm text-danger">
                Critical Issues ({dangerWarnings.length}):
              </div>
              {dangerWarnings.map((warning, idx) => (
                <div key={idx} className="text-sm text-danger pl-4">
                  • {warning.message}
                </div>
              ))}
            </div>
          )}

          {regularWarnings.length > 0 && (
            <div className="space-y-2">
              <div className="font-semibold text-sm text-warning">
                Considerations ({regularWarnings.length}):
              </div>
              {regularWarnings.map((warning, idx) => (
                <div key={idx} className="text-sm text-warning pl-4">
                  • {warning.message}
                </div>
              ))}
            </div>
          )}

          {infoWarnings.length > 0 && (
            <div className="space-y-2">
              <div className="font-semibold text-sm text-primary">
                Notes ({infoWarnings.length}):
              </div>
              {infoWarnings.map((warning, idx) => (
                <div key={idx} className="text-sm text-primary pl-4">
                  • {warning.message}
                </div>
              ))}
            </div>
          )}

          {warnings.length === 0 && (
            <div className="text-sm text-success">
              ✅ All parameters are within recommended ranges.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
