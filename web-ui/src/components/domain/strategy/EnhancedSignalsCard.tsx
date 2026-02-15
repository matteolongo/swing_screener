/**
 * Enhanced Signals Card - Demonstrates Layer 1-3 education integration
 * This is a proof-of-concept showing how to integrate educational components
 */
import { useMemo } from 'react';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { t } from '@/i18n/t';
import { Strategy } from '@/features/strategy/types';
import { EducationalNumberInput } from './EducationalFieldControls';
import { evaluateStrategy } from '@/utils/strategySafety';

interface EnhancedSignalsCardProps {
  draft: Strategy;
  setDraft: (value: Strategy) => void;
}

export default function EnhancedSignalsCard({ draft, setDraft }: EnhancedSignalsCardProps) {
  // Get warnings for current configuration
  const warnings = useMemo(() => {
    const allWarnings = evaluateStrategy(draft);
    return {
      breakoutLookback: allWarnings.find((w) => w.parameter === 'breakoutLookback'),
      pullbackMa: allWarnings.find((w) => w.parameter === 'pullbackMa'),
    };
  }, [draft]);

  return (
    <Card variant="bordered">
      <CardHeader>
        <CardTitle>{t('strategyPage.core.cards.signals.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Breakout Lookback - with full educational treatment */}
          <EducationalNumberInput
            label="Breakout Lookback"
            microcopy="How many days a stock must exceed to signal strength"
            value={draft.signals.breakoutLookback}
            onChange={(value) =>
              setDraft({
                ...draft,
                signals: { ...draft.signals, breakoutLookback: value },
              })
            }
            step={1}
            min={1}
            parameterKey="breakoutLookback"
            strategyModule={draft.module ?? 'momentum'}
            warning={warnings.breakoutLookback}
            recommendedBadge={draft.signals.breakoutLookback >= 40 && draft.signals.breakoutLookback <= 60}
          />

          {/* Pullback MA - with full educational treatment */}
          <EducationalNumberInput
            label="Pullback Moving Average"
            microcopy="The price level where healthy pullbacks can occur before resuming upward"
            value={draft.signals.pullbackMa}
            onChange={(value) =>
              setDraft({
                ...draft,
                signals: { ...draft.signals, pullbackMa: value },
              })
            }
            step={1}
            min={1}
            parameterKey="pullbackMa"
            strategyModule={draft.module ?? 'momentum'}
            warning={warnings.pullbackMa}
            recommendedBadge={draft.signals.pullbackMa >= 20 && draft.signals.pullbackMa <= 30}
          />

          {/* Min History - simplified for less critical parameters */}
          <EducationalNumberInput
            label="Minimum History (days)"
            microcopy="Required data history for reliable indicators"
            value={draft.signals.minHistory}
            onChange={(value) =>
              setDraft({
                ...draft,
                signals: { ...draft.signals, minHistory: value },
              })
            }
            step={1}
            min={1}
            strategyModule={draft.module ?? 'momentum'}
          />
        </div>
      </CardContent>
    </Card>
  );
}
