/**
 * Enhanced Risk Card - Critical parameters with emphasis on education
 * Demonstrates high-impact parameter treatment
 */
import Card, { CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { Strategy } from '@/features/strategy/types';
import { EducationalNumberInput } from './EducationalFieldControls';
import type { ValidationWarning } from '@/features/strategy/api';

interface EnhancedRiskCardProps {
  draft: Strategy;
  setDraft: (value: Strategy) => void;
  warnings: ValidationWarning[];
}

export default function EnhancedRiskCard({ draft, setDraft, warnings }: EnhancedRiskCardProps) {
  const riskPerTradeWarning = warnings.find((warning) => warning.parameter === 'riskPerTrade');

  return (
    <Card variant="bordered" className="border-orange-200 bg-orange-50/30 dark:bg-orange-900/10 dark:border-orange-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-xl">⚖️</span>
          <span>Risk Management — Your First Priority</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Account Size */}
          <EducationalNumberInput
            label="Account Size"
            microcopy="Your total trading capital (determines position sizing)"
            value={draft.risk.accountSize}
            onChange={(value) =>
              setDraft({
                ...draft,
                risk: { ...draft.risk, accountSize: value },
              })
            }
            step={1000}
            min={0}
          />

          {/* Risk Per Trade - CRITICAL */}
          <div className="border-2 border-orange-300 dark:border-orange-700 rounded-lg p-4 bg-white dark:bg-gray-800">
            <EducationalNumberInput
              label="Risk Per Trade"
              microcopy="Maximum % of account to risk on a single trade — professional traders rarely exceed 2%"
              value={draft.risk.riskPct * 100}
              onChange={(value) =>
                setDraft({
                  ...draft,
                  risk: { ...draft.risk, riskPct: value / 100 },
                })
              }
              step={0.1}
              min={0}
              max={10}
              suffix="%"
              warning={riskPerTradeWarning}
              recommendedBadge={draft.risk.riskPct * 100 >= 1 && draft.risk.riskPct * 100 <= 2}
            />
          </div>

          {/* Max Position Size */}
          <EducationalNumberInput
            label="Max Position Size"
            microcopy="Maximum % of account in any single position (prevents over-concentration)"
            value={draft.risk.maxPositionPct * 100}
            onChange={(value) =>
              setDraft({
                ...draft,
                risk: { ...draft.risk, maxPositionPct: value / 100 },
              })
            }
            step={1}
            min={0}
            max={100}
            suffix="%"
            recommendedBadge={draft.risk.maxPositionPct * 100 <= 20}
          />

          {/* ATR Multiplier */}
          <EducationalNumberInput
            label="ATR Multiplier (Stop Distance)"
            microcopy="How many ATRs away to place your stop loss (balances safety vs noise)"
            value={draft.risk.kAtr}
            onChange={(value) =>
              setDraft({
                ...draft,
                risk: { ...draft.risk, kAtr: value },
              })
            }
            step={0.1}
            min={0}
            parameterKey="atrWindow"
            strategyModule={draft.module ?? 'momentum'}
            recommendedBadge={draft.risk.kAtr >= 1.5 && draft.risk.kAtr <= 3}
          />
        </div>
      </CardContent>
    </Card>
  );
}
