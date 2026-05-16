import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { BeginnerOrderReadiness } from '@/features/screener/beginnerDecision';
import { t } from '@/i18n/t';

export interface OrderReadinessGateProps {
  readiness: BeginnerOrderReadiness;
  children: React.ReactNode;
}

/**
 * Guards the order CTA area for beginner users based on order readiness.
 *
 * - `ready` or `manage_existing`: render children directly, no gate UI
 * - `wait_for_price` or `watch_only`: show a warning banner, then render children (still accessible)
 * - `avoid` or `incomplete`: show a warning banner + checkbox; children only rendered when checkbox checked
 */
export default function OrderReadinessGate({ readiness, children }: OrderReadinessGateProps) {
  const [overrideChecked, setOverrideChecked] = useState(false);

  if (readiness === 'ready' || readiness === 'manage_existing') {
    return <>{children}</>;
  }

  const requiresOverride = readiness === 'avoid' || readiness === 'incomplete';

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden="true" />
        <span>
          {requiresOverride
            ? t('orderGate.avoidWarning')
            : t('orderGate.notReadyWarning')}
        </span>
      </div>

      {requiresOverride ? (
        <>
          <label className="flex cursor-pointer items-start gap-2 rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-900 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
            <input
              type="checkbox"
              checked={overrideChecked}
              onChange={(e) => setOverrideChecked(e.target.checked)}
              className="mt-0.5"
            />
            <span>{t('orderGate.overrideLabel')}</span>
          </label>
          {overrideChecked ? <>{children}</> : null}
        </>
      ) : (
        <>{children}</>
      )}
    </div>
  );
}
