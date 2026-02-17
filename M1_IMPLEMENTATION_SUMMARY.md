# M1: Foundations and Gating for Beginner-Guided UX

> **Status: Archived milestone summary.**  
> **Last Reviewed:** February 17, 2026.

## Overview

This milestone implements the core infrastructure for the Beginner-Guided UX as defined in GitHub issue #87, Milestone 1.

## What Was Implemented

### 1. Core State Management

#### `beginnerModeStore.ts`
- Global Zustand store with localStorage persistence
- Defaults to `true` (Beginner Mode ON) for new users
- Provides `isBeginnerMode`, `setBeginnerMode()`, and `toggleBeginnerMode()` APIs
- Persisted under key: `swing-screener-beginner-mode`

#### `onboardingStore.ts`
- Tracks onboarding flow state with localStorage persistence
- Status: `new`, `dismissed`, or `completed`
- Tracks current step index (0-based)
- Provides methods: `setStatus()`, `setCurrentStep()`, `dismissOnboarding()`, `completeOnboarding()`, `resetOnboarding()`
- Persisted under key: `swing-screener-onboarding`

### 2. Navigation Gating (Sidebar)

#### Updated `Sidebar.tsx`
- Added Beginner/Advanced mode toggle in sidebar footer
- Toggle is a visual switch with accessible label
- Shows current mode text: "Beginner" or "Advanced"
- Navigation items now include `advanced: boolean` flag
- In Beginner Mode:
  - **Enabled**: Dashboard, Daily Review, Screener, Orders, Positions, Strategy, Settings
  - **Disabled**: Backtest (and other advanced surfaces to be added later)
- Disabled items show:
  - Grayed out appearance (`text-gray-400`, `cursor-not-allowed`)
  - Non-clickable (click event prevented)
  - Hover tooltip: "Enable Advanced Mode to access"

#### i18n Messages Added
```typescript
sidebar: {
  mode: {
    label: 'Mode',
    beginner: 'Beginner',
    advanced: 'Advanced',
    toggle: 'Toggle between Beginner and Advanced mode',
  },
  disabledHint: 'Enable Advanced Mode to access',
}
```

### 3. Strategy Readiness Infrastructure

#### `useStrategyReadiness.ts`
Provides utilities to check if the active strategy is properly configured:

**Functions:**
- `isStrategyConfigured(strategy)` - Boolean check if strategy is ready
- `getStrategyReadiness(strategy, isLoading)` - Detailed readiness information
- `useStrategyReadiness()` - React hook for components

**Readiness Criteria:**
A strategy is considered "ready" if:
1. An active strategy exists
2. `accountSize > 0`
3. `riskPct > 0`
4. `maxPositionPct > 0`

**Return Type:**
```typescript
interface StrategyReadiness {
  isReady: boolean;
  hasActiveStrategy: boolean;
  hasValidAccountSize: boolean;
  hasValidRiskParams: boolean;
  isLoading: boolean;
  issues: string[]; // Human-readable configuration issues
}
```

## Test Coverage

### Store Tests
- **beginnerModeStore.test.ts**: 5 tests
  - Default state initialization
  - Toggle functionality
  - localStorage persistence
  
- **onboardingStore.test.ts**: 8 tests
  - Status transitions
  - Step tracking
  - Dismiss/complete/reset flows
  - localStorage persistence

### Component Tests
- **Sidebar.test.tsx**: 8 tests
  - Renders all navigation items
  - Mode toggle visibility and functionality
  - Disables backtest in beginner mode
  - Enables all nav in advanced mode
  - Click prevention on disabled items
  - Persistence across remounts

### Hook Tests
- **useStrategyReadiness.test.ts**: 19 tests
  - Configuration validation
  - Issue detection
  - Hook behavior
  - Edge cases (null/undefined strategies)

**Total new tests: 40**

## Usage Examples

### Using Beginner Mode Store
```typescript
import { useBeginnerModeStore } from '@/stores/beginnerModeStore';

function MyComponent() {
  const { isBeginnerMode, toggleBeginnerMode } = useBeginnerModeStore();
  
  return (
    <button onClick={toggleBeginnerMode}>
      {isBeginnerMode ? 'Switch to Advanced' : 'Switch to Beginner'}
    </button>
  );
}
```

### Using Strategy Readiness
```typescript
import { useStrategyReadiness } from '@/features/strategy/hooks';

function DailyReviewPage() {
  const { isReady, issues } = useStrategyReadiness();
  
  if (!isReady) {
    return (
      <div>
        <h2>Strategy Configuration Required</h2>
        <ul>
          {issues.map(issue => <li key={issue}>{issue}</li>)}
        </ul>
        <Link to="/strategy">Configure Strategy</Link>
      </div>
    );
  }
  
  return <div>Ready to review trades!</div>;
}
```

### Using Onboarding Store
```typescript
import { useOnboardingStore } from '@/stores/onboardingStore';

function OnboardingModal() {
  const { status, currentStep, setCurrentStep, completeOnboarding } = useOnboardingStore();
  
  if (status === 'completed' || status === 'dismissed') {
    return null;
  }
  
  return (
    <Modal>
      <Steps step={currentStep} />
      <button onClick={() => setCurrentStep(currentStep + 1)}>Next</button>
      <button onClick={completeOnboarding}>Complete</button>
    </Modal>
  );
}
```

## Files Added

```
web-ui/src/stores/
  ├── beginnerModeStore.ts
  ├── beginnerModeStore.test.ts
  ├── onboardingStore.ts
  └── onboardingStore.test.ts

web-ui/src/features/strategy/
  ├── useStrategyReadiness.ts
  └── useStrategyReadiness.test.ts

web-ui/src/components/layout/
  └── Sidebar.test.tsx (new)
```

## Files Modified

```
web-ui/src/components/layout/
  └── Sidebar.tsx (added mode toggle and navigation gating)

web-ui/src/features/strategy/
  └── hooks.ts (re-exported readiness utilities)

web-ui/src/i18n/
  └── messages.en.ts (added mode and disabled nav translations)
```

## Acceptance Criteria ✅

- ✅ New users default to Beginner Mode ON
- ✅ Mode persists across browser reloads (via localStorage)
- ✅ Disabled nav items are non-clickable with explanatory message
- ✅ Readiness state is consumable by other pages via `useStrategyReadiness()`

## Next Steps (M2 & M3)

This milestone provides the foundation for:

**M2: Guided Daily Flow**
- Onboarding modal wizard (using `useOnboardingStore`)
- Dashboard "Today's Next Action" section (using `isBeginnerMode`)
- Daily Review readiness blocker (using `useStrategyReadiness`)

**M3: Simplification and Polish**
- Screener beginner defaults (using `isBeginnerMode`)
- Simplified Orders/Positions tables (using `isBeginnerMode`)
- Full documentation and regression testing

## Testing

All tests pass with no regressions:
```bash
cd web-ui
npm test          # 300 tests pass
npm run lint      # No warnings
npm run typecheck # No type errors
```

## Visual Changes

The Sidebar now includes:
1. A mode toggle switch in the footer section
2. Current mode label ("Beginner" or "Advanced")
3. Disabled state for Backtest link in Beginner Mode with tooltip on hover

See the Sidebar component for visual implementation details.
