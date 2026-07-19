/**
 * Configuration readiness summary. The legacy numeric score is intentionally
 * not displayed: it does not prove portfolio, event, or execution safeguards.
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
  const level = validation?.safetyLevel ?? 'expert-only';
  const warnings = validation?.warnings ?? [];

  const levelConfig = {
    'beginner-safe': {
      color: 'text-success',
      bgColor: 'bg-success/10',
      borderColor: 'border-success/40',
      icon: '🟢',
      label: 'Configuration checks passed',
      message: 'The configured parameter checks passed. Order-time portfolio approval is still required.',
    },
    'requires-discipline': {
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/40',
      icon: '🟡',
      label: 'Review required',
      message: 'One or more configured parameters need review before relying on this strategy.',
    },
    'expert-only': {
      color: 'text-danger',
      bgColor: 'bg-danger/10',
      borderColor: 'border-danger/40',
      icon: '🔴',
      label: 'Configuration blocked',
      message: 'Critical configuration checks failed. Do not treat this strategy as order-ready.',
    },
  };

  const config = levelConfig[level];
  const dangerWarnings = warnings.filter((w) => w.level === 'danger');
  const regularWarnings = warnings.filter((w) => w.level === 'warning');
  const infoWarnings = warnings.filter((w) => w.level === 'info');

  if (isLoading && !validation) {
    return <Card variant="bordered"><CardContent><div className="text-sm text-muted">Validating current parameters...</div></CardContent></Card>;
  }
  if (isError || !validation) {
    return <Card variant="bordered"><CardContent><div className="text-sm text-danger">Configuration readiness unavailable. No safety conclusion can be made.</div></CardContent></Card>;
  }

  return (
    <Card variant="bordered" className={`${config.borderColor} ${config.bgColor}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className={config.color}>Configuration Readiness</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {isLoading && (
            <div className="text-sm text-muted">
              Validating current parameters...
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
              All currently implemented configuration checks passed. This is not an order approval.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
