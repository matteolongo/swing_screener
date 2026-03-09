/**
 * Strategy Presets Component
 * Provides beginner-friendly preset configurations
 */
import {
  Strategy,
  StrategyFilt,
  StrategyManage,
  StrategyRisk,
  StrategySignals,
} from '@/features/strategy/types';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';

/** Partial overrides a preset can apply. Only top-level sections and their partial fields are covered. */
export interface StrategyPresetValues {
  risk?: Partial<StrategyRisk>;
  signals?: Partial<StrategySignals>;
  universe?: { filt?: Partial<StrategyFilt> };
  manage?: Partial<StrategyManage>;
}

export interface StrategyPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  level: 'conservative' | 'balanced' | 'aggressive';
  values: StrategyPresetValues;
}

export const momentumPresets: StrategyPreset[] = [
  {
    id: 'conservative',
    name: 'Conservative',
    description: 'Lower risk, fewer trades, focus on strongest setups only',
    icon: '🛡️',
    level: 'conservative',
    values: {
      risk: {
        riskPct: 0.01, // 1%
        maxPositionPct: 0.15, // 15%
        kAtr: 2.5,
        minRr: 2.5,
        maxFeeRiskPct: 0.15,
      },
      signals: {
        breakoutLookback: 60,
        pullbackMa: 20,
        minHistory: 252,
      },
      universe: {
        filt: {
          maxAtrPct: 12.0, // 12%
          requireTrendOk: true,
          requireRsPositive: true,
        },
      },
      manage: {
        breakevenAtR: 1,
        trailAfterR: 2,
        maxHoldingDays: 20,
      },
    },
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Standard settings balancing opportunity with risk control',
    icon: '⚖️',
    level: 'balanced',
    values: {
      risk: {
        riskPct: 0.015, // 1.5%
        maxPositionPct: 0.20, // 20%
        kAtr: 2.0,
        minRr: 2.0,
        maxFeeRiskPct: 0.20,
      },
      signals: {
        breakoutLookback: 50,
        pullbackMa: 20,
        minHistory: 252,
      },
      universe: {
        filt: {
          maxAtrPct: 15.0, // 15%
          requireTrendOk: true,
          requireRsPositive: false,
        },
      },
      manage: {
        breakevenAtR: 1,
        trailAfterR: 2,
        maxHoldingDays: 20,
      },
    },
  },
  {
    id: 'aggressive',
    name: 'Aggressive',
    description: 'Higher risk, more opportunities, requires discipline',
    icon: '🚀',
    level: 'aggressive',
    values: {
      risk: {
        riskPct: 0.02, // 2%
        maxPositionPct: 0.25, // 25%
        kAtr: 1.5,
        minRr: 1.5,
        maxFeeRiskPct: 0.25,
      },
      signals: {
        breakoutLookback: 40,
        pullbackMa: 20,
        minHistory: 200,
      },
      universe: {
        filt: {
          maxAtrPct: 18.0, // 18%
          requireTrendOk: false,
          requireRsPositive: false,
        },
      },
      manage: {
        breakevenAtR: 1,
        trailAfterR: 2.5,
        maxHoldingDays: 25,
      },
    },
  },
];

interface StrategyPresetsProps {
  currentStrategy?: Strategy; // Optional, could be used to highlight current preset
  onApplyPreset: (preset: StrategyPreset) => void;
}

export default function StrategyPresets({ onApplyPreset }: StrategyPresetsProps) {
  return (
    <Card variant="bordered">
      <CardHeader>
        <CardTitle>Quick Start Presets</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Start with a proven configuration. You can customize it later.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {momentumPresets.map((preset) => (
            <div
              key={preset.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{preset.icon}</span>
                <h3 className="font-semibold text-lg">{preset.name}</h3>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {preset.description}
              </p>

              <div className="space-y-1 text-xs text-gray-500 dark:text-gray-500">
                <div>Risk/Trade: {((preset.values.risk?.riskPct ?? 0) * 100).toFixed(1)}%</div>
                <div>
                  Breakout Lookback: {preset.values.signals?.breakoutLookback ?? 'N/A'}
                </div>
                <div>Min R:R: {preset.values.risk?.minRr ?? 'N/A'}</div>
              </div>

              <Button
                variant="secondary"
                onClick={() => onApplyPreset(preset)}
                className="w-full"
              >
                Apply {preset.name}
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-800 dark:text-blue-200">
          💡 <strong>Tip:</strong> Conservative is recommended for your first 20-30 trades while you learn
          the system.
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Apply a preset to a strategy, merging values intelligently
 */
export function applyPresetToStrategy(strategy: Strategy, preset: StrategyPreset): Strategy {
  return {
    ...strategy,
    risk: {
      ...strategy.risk,
      ...preset.values.risk,
    },
    signals: {
      ...strategy.signals,
      ...preset.values.signals,
    },
    universe: {
      ...strategy.universe,
      filt: {
        ...strategy.universe.filt,
        ...preset.values.universe?.filt,
      },
    },
    manage: {
      ...strategy.manage,
      ...preset.values.manage,
    },
  };
}
