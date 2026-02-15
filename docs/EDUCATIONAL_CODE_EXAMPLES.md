# Educational Transformation - Code Examples

This document provides code examples showing how the educational system works.

## 📚 Documentation Format

### momentum.json Structure

```json
{
  "strategy": {
    "id": "momentum",
    "name": "Momentum Strategy",
    "philosophy": "Buy strong stocks making sustained upward moves...",
    "idealFor": "Beginners who want a systematic, once-per-day decision process...",
    "holdingPeriod": "Typically 5–20 trading days.",
    "coreRule": "Protect capital first. Profits come from consistency, not prediction."
  },
  "parameters": {
    "breakoutLookback": {
      "parameter": "breakoutLookback",
      "category": "signals",
      "whatItIs": "The number of past trading days...",
      "whyItMatters": "Stocks reaching new highs...",
      "howItAffectsTrades": "Controls how 'strong' a trend must be...",
      "tradeoffs": {
        "lower": "More signals but more false breakouts.",
        "higher": "Stronger trends but fewer opportunities."
      },
      "beginnerRange": "40–60 days",
      "defaultGuidance": "50 is a well-balanced setting...",
      "dangerZone": "Below 20 turns this into short-term trading...",
      "proTip": "Your job is not to catch the bottom..."
    }
  }
}
```

## 🎨 Component Usage Examples

### 1. Strategy Philosophy Card

```tsx
import StrategyPhilosophyCard from '@/components/domain/strategy/StrategyPhilosophyCard';
import { getStrategyInfo } from '@/content/strategy_docs/loader';

function MyComponent() {
  const strategyInfo = getStrategyInfo('momentum');
  
  if (!strategyInfo) return null;
  
  return <StrategyPhilosophyCard strategyInfo={strategyInfo} />;
}
```

**Renders:**
```
┌─────────────────────────────────────────────────────────┐
│ 🎯 Momentum Strategy — How It Thinks                    │
├─────────────────────────────────────────────────────────┤
│ Buy strong stocks making sustained upward moves and     │
│ manage risk so that winners are larger than losers.     │
│                                                          │
│ Ideal for:              Typical holding time:           │
│ Beginners who want...   5–20 trading days               │
│                                                          │
│ 💡 Core Rule: Protect capital first. Profits come from  │
│ consistency, not prediction.                             │
└─────────────────────────────────────────────────────────┘
```

### 2. Safety Score Component

```tsx
import StrategySafetyScore from '@/components/domain/strategy/StrategySafetyScore';
import type { Strategy } from '@/features/strategy/types';

function MyComponent({ strategy }: { strategy: Strategy }) {
  return <StrategySafetyScore strategy={strategy} />;
}
```

**Renders (high score):**
```
┌─────────────────────────────────────────────────────────┐
│ Strategy Safety Score              92 / 100             │
├─────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────┐   │
│ │ 🟢  Beginner Safe                                  │   │
│ │                                                    │   │
│ │ This configuration follows conservative best       │   │
│ │ practices.                                         │   │
│ └───────────────────────────────────────────────────┘   │
│                                                          │
│ ✅ All parameters are within recommended ranges.         │
└─────────────────────────────────────────────────────────┘
```

**Renders (low score with warnings):**
```
┌─────────────────────────────────────────────────────────┐
│ Strategy Safety Score              62 / 100             │
├─────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────┐   │
│ │ 🔴  Expert Only                                    │   │
│ │                                                    │   │
│ │ This configuration has elevated risk. Only use    │   │
│ │ with extensive experience.                        │   │
│ └───────────────────────────────────────────────────┘   │
│                                                          │
│ Critical Issues (2):                                     │
│ • Breakout Lookback below 20 behaves more like day      │
│   trading than swing trading                             │
│ • Minimum R/R under 2 makes profitability statistically  │
│   harder                                                 │
└─────────────────────────────────────────────────────────┘
```

### 3. Educational Number Input

```tsx
import { EducationalNumberInput } from '@/components/domain/strategy/EducationalFieldControls';

function SignalsCard({ draft, setDraft }) {
  const warnings = evaluateStrategy(draft);
  const breakoutWarning = warnings.find(w => w.parameter === 'breakoutLookback');
  
  return (
    <EducationalNumberInput
      label="Breakout Lookback"
      microcopy="How many days a stock must exceed to signal strength"
      value={draft.signals.breakoutLookback}
      onChange={(value) => setDraft({
        ...draft,
        signals: { ...draft.signals, breakoutLookback: value }
      })}
      step={1}
      min={1}
      parameterKey="breakoutLookback"
      strategyModule="momentum"
      warning={breakoutWarning}
      recommendedBadge={draft.signals.breakoutLookback >= 40 && 
                       draft.signals.breakoutLookback <= 60}
    />
  );
}
```

**Renders:**
```
┌─────────────────────────────────────────────────────────┐
│ Breakout Lookback  ✔ Recommended                        │
│ How many days a stock must exceed to signal strength    │
│ [ 50 ]                                                   │
│                                                          │
│ ┌───────────────────────────────────────────────────┐   │
│ │ 💡 Why this matters                              ▼│   │
│ └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**When expanded:**
```
┌─────────────────────────────────────────────────────────┐
│ Breakout Lookback  ✔ Recommended                        │
│ How many days a stock must exceed to signal strength    │
│ [ 50 ]                                                   │
│                                                          │
│ ┌───────────────────────────────────────────────────┐   │
│ │ 💡 Why this matters                              ▲│   │
│ ├───────────────────────────────────────────────────┤   │
│ │ What it is:                                       │   │
│ │ The number of past trading days a stock must      │   │
│ │ exceed to qualify as a breakout.                  │   │
│ │                                                   │   │
│ │ Why it matters:                                   │   │
│ │ Stocks reaching new highs often attract           │   │
│ │ institutional buyers...                           │   │
│ │                                                   │   │
│ │ Tradeoffs:                                        │   │
│ │ • Lower: More signals but more false breakouts    │   │
│ │ • Higher: Stronger trends but fewer opportunities │   │
│ │                                                   │   │
│ │ ✅ Beginner range: 40–60 days                     │   │
│ │                                                   │   │
│ │ 💚 Recommended guidance:                          │   │
│ │ 50 is a well-balanced setting used in many        │   │
│ │ momentum models.                                  │   │
│ │                                                   │   │
│ │ ⚠️ Danger zone:                                   │   │
│ │ Below 20 turns this into short-term trading...    │   │
│ │                                                   │   │
│ │ 🎓 Pro tip:                                       │   │
│ │ Your job is not to catch the bottom — it's to    │   │
│ │ join proven strength.                             │   │
│ └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**With warning (value = 15):**
```
┌─────────────────────────────────────────────────────────┐
│ Breakout Lookback                                        │
│ How many days a stock must exceed to signal strength    │
│ [ 15 ]                                                   │
│                                                          │
│ ┌───────────────────────────────────────────────────┐   │
│ │ 🚨 Breakout Lookback below 20 behaves more like   │   │
│ │    day trading than swing trading.                │   │
│ └───────────────────────────────────────────────────┘   │
│                                                          │
│ ┌───────────────────────────────────────────────────┐   │
│ │ 💡 Why this matters                              ▼│   │
│ └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 4. Beginner Mode Toggle

```tsx
import BeginnerModeToggle from '@/components/domain/strategy/BeginnerModeToggle';

function StrategyPage() {
  const [isBeginnerMode, setIsBeginnerMode] = useState(true);
  
  return (
    <BeginnerModeToggle
      isBeginnerMode={isBeginnerMode}
      onToggle={setIsBeginnerMode}
    />
  );
}
```

**Renders (beginner mode ON):**
```
┌─────────────────────────────────────────────────────────┐
│ Configuration Mode                                       │
├─────────────────────────────────────────────────────────┤
│ [●────] 🎓 Beginner Mode                                 │
│                                                          │
│ ✅ Simplified configuration with smart defaults          │
│ • Only essential parameters shown                        │
│ • Extra guidance and explanations                        │
│ • Conservative, beginner-safe defaults                   │
│ • Clear warnings for risky changes                       │
└─────────────────────────────────────────────────────────┘
```

**Renders (advanced mode ON):**
```
┌─────────────────────────────────────────────────────────┐
│ Configuration Mode                                       │
├─────────────────────────────────────────────────────────┤
│ [────●] ⚙️ Advanced Mode                                 │
│                                                          │
│ ⚠️ Full control with all advanced options                │
│ • All parameters available                               │
│ • Regime scaling and fine-tuning                         │
│ • Requires experience to use safely                      │
│ • Easy to create risky configurations                    │
└─────────────────────────────────────────────────────────┘
```

### 5. Strategy Presets

```tsx
import StrategyPresets, { applyPresetToStrategy } from '@/components/domain/strategy/StrategyPresets';

function MyComponent({ draft, setDraft }) {
  return (
    <StrategyPresets
      currentStrategy={draft}
      onApplyPreset={(preset) => {
        const updated = applyPresetToStrategy(draft, preset);
        setDraft(updated);
      }}
    />
  );
}
```

**Renders:**
```
┌─────────────────────────────────────────────────────────┐
│ Quick Start Presets                                      │
├─────────────────────────────────────────────────────────┤
│ Start with a proven configuration. You can customize     │
│ it later.                                                │
│                                                          │
│ ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│ │ 🛡️        │  │ ⚖️        │  │ 🚀        │               │
│ │ Conserva- │  │ Balanced  │  │ Aggress-  │               │
│ │ tive      │  │           │  │ ive       │               │
│ │           │  │ Standard  │  │ Higher    │               │
│ │ Lower     │  │ settings  │  │ risk,     │               │
│ │ risk,     │  │ balancing │  │ more      │               │
│ │ fewer     │  │ opport-   │  │ opportu-  │               │
│ │ trades    │  │ unity     │  │ nities    │               │
│ │           │  │ with risk │  │           │               │
│ │ Risk: 1%  │  │           │  │ Risk: 2%  │               │
│ │ Lookback: │  │ Risk: 1.5%│  │ Lookback: │               │
│ │ 60        │  │ Lookback: │  │ 40        │               │
│ │ R:R: 2.5  │  │ 50        │  │ R:R: 1.5  │               │
│ │           │  │ R:R: 2.0  │  │           │               │
│ │ [Apply]   │  │ [Apply]   │  │ [Apply]   │               │
│ └──────────┘  └──────────┘  └──────────┘               │
│                                                          │
│ 💡 Tip: Conservative is recommended for your first       │
│ 20-30 trades while you learn the system.                 │
└─────────────────────────────────────────────────────────┘
```

## 🔍 Safety Evaluation Example

```tsx
import { evaluateStrategy, calculateSafetyScore, getSafetyLevel } from '@/utils/strategySafety';

// Evaluate a strategy
const warnings = evaluateStrategy(myStrategy);
// Returns: [
//   { parameter: 'breakoutLookback', level: 'danger', message: '...' },
//   { parameter: 'riskPerTrade', level: 'warning', message: '...' }
// ]

// Calculate score
const score = calculateSafetyScore(myStrategy);
// Returns: 77

// Get level
const level = getSafetyLevel(score);
// Returns: 'requires-discipline'
```

## 📖 Loading Documentation

```tsx
import { loadStrategyDocs, getParameterDoc, getStrategyInfo } from '@/content/strategy_docs/loader';

// Load full strategy docs
const docs = loadStrategyDocs('momentum');
// Returns: { strategy: {...}, parameters: {...} }

// Get specific parameter
const breakoutDoc = getParameterDoc('momentum', 'breakoutLookback');
// Returns: { parameter: 'breakoutLookback', whatItIs: '...', ... }

// Get strategy info
const info = getStrategyInfo('momentum');
// Returns: { id: 'momentum', name: '...', philosophy: '...', ... }
```

## 🎯 Complete Integration Example

```tsx
import { useState } from 'react';
import type { Strategy } from '@/features/strategy/types';
import { getStrategyInfo } from '@/content/strategy_docs/loader';

// Import components
import StrategyPhilosophyCard from '@/components/domain/strategy/StrategyPhilosophyCard';
import BeginnerModeToggle from '@/components/domain/strategy/BeginnerModeToggle';
import StrategyPresets, { applyPresetToStrategy } from '@/components/domain/strategy/StrategyPresets';
import StrategySafetyScore from '@/components/domain/strategy/StrategySafetyScore';
import EnhancedSignalsCard from '@/components/domain/strategy/EnhancedSignalsCard';
import EnhancedRiskCard from '@/components/domain/strategy/EnhancedRiskCard';

function StrategyConfiguration({ initialStrategy }: { initialStrategy: Strategy }) {
  const [draft, setDraft] = useState(initialStrategy);
  const [isBeginnerMode, setIsBeginnerMode] = useState(true);
  
  const strategyInfo = getStrategyInfo(draft.module ?? 'momentum');
  
  return (
    <div className="space-y-6">
      {/* Philosophy */}
      {strategyInfo && <StrategyPhilosophyCard strategyInfo={strategyInfo} />}
      
      {/* Mode Toggle */}
      <BeginnerModeToggle
        isBeginnerMode={isBeginnerMode}
        onToggle={setIsBeginnerMode}
      />
      
      {/* Presets (beginner only) */}
      {isBeginnerMode && (
        <StrategyPresets
          currentStrategy={draft}
          onApplyPreset={(preset) => {
            const updated = applyPresetToStrategy(draft, preset);
            setDraft(updated);
          }}
        />
      )}
      
      {/* Safety Score */}
      <StrategySafetyScore strategy={draft} />
      
      {/* Enhanced Fields */}
      <EnhancedSignalsCard draft={draft} setDraft={setDraft} />
      <EnhancedRiskCard draft={draft} setDraft={setDraft} />
      
      {/* Advanced settings only in advanced mode */}
      {!isBeginnerMode && (
        <AdvancedSettingsCard draft={draft} setDraft={setDraft} />
      )}
    </div>
  );
}
```

## 📝 Adding a New Strategy

To add education for a new strategy:

1. Create `web-ui/src/content/strategy_docs/new_strategy.json`:

```json
{
  "strategy": {
    "id": "new_strategy",
    "name": "New Strategy",
    "philosophy": "...",
    "idealFor": "...",
    "holdingPeriod": "...",
    "coreRule": "..."
  },
  "parameters": {
    "parameterName": {
      "parameter": "parameterName",
      "category": "signals",
      "whatItIs": "...",
      "whyItMatters": "...",
      "howItAffectsTrades": "...",
      "tradeoffs": {
        "lower": "...",
        "higher": "..."
      },
      "beginnerRange": "...",
      "defaultGuidance": "...",
      "dangerZone": "...",
      "proTip": "..."
    }
  }
}
```

2. Update `web-ui/src/content/strategy_docs/loader.ts`:

```tsx
import newStrategyDocs from './new_strategy.json';

const strategyDocsMap: Record<string, StrategyDocumentation> = {
  momentum: momentumDocs as StrategyDocumentation,
  new_strategy: newStrategyDocs as StrategyDocumentation,
};
```

3. Done! The documentation will automatically be available via:
   - `getStrategyInfo('new_strategy')`
   - `getParameterDoc('new_strategy', 'parameterName')`
   - All UI components will work automatically

---

This scalable pattern makes adding education for new strategies extremely easy!
