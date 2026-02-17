# Onboarding & Beginner Guide Features

> **Status: Needs review.** Verify against current UI and education flow.  
> **Last Reviewed:** February 17, 2026.

## Overview

Swing Screener implements a **progressive education system** rather than traditional modal-based onboarding. The goal is to provide contextual, opt-in education that helps beginners without disrupting experienced users.

## Design Philosophy

- **No modal interruptions** - Education is always available but never forced
- **Progressive disclosure** - Beginners see simplified UI; advanced users get full control
- **Contextual help** - Guidance appears where it's relevant
- **Layer-by-layer learning** - Users can dig deeper when ready

---

## Feature Catalog

### 1. Beginner Mode Toggle

**Location**: Strategy page (`/strategy`)  
**Component**: `/web-ui/src/components/domain/strategy/BeginnerModeToggle.tsx`

#### What It Does

A toggle switch that transforms the entire Strategy configuration interface between two modes:

**🎓 Beginner Mode** (Default):
- Simplified configuration with smart defaults
- Only essential parameters shown
- Extra guidance and explanations throughout
- Quick Start Presets visible (Conservative/Balanced/Aggressive)
- Conservative, beginner-safe defaults
- Clear warnings for risky changes
- Detailed "Why this matters" sections for each parameter

**⚙️ Advanced Mode**:
- All parameters available
- Regime scaling and fine-tuning options
- Advanced Settings section unlocked
- Requires experience to use safely
- Minimal explanatory text (assumes expertise)

#### How to Use

1. Navigate to Strategy page
2. Find "Configuration Mode" card near the top
3. Click the toggle switch to change modes
4. Mode preference is saved per session

#### When to Use Which Mode

- **Use Beginner Mode if**:
  - You're new to swing trading
  - You want guided configuration
  - You prefer conservative defaults
  - You're making your first 20-30 trades

- **Use Advanced Mode if**:
  - You understand R-based risk management
  - You need regime scaling or custom filters
  - You want to fine-tune every parameter
  - You're experienced with the system

---

### 2. Getting Started Card

**Location**: Dashboard (`/dashboard`)  
**Component**: `/web-ui/src/pages/Dashboard.tsx` (lines 482-500)

#### What It Does

A welcome card that appears automatically for **new users** (users with no positions and no orders). It provides a simple 4-step roadmap to get started with the system.

#### The 4 Steps

1. **Review/customize strategy** - Link to Settings page to configure your approach
2. **Run Screener** - Find trade candidates that match your criteria
3. **Create orders** - Turn screener results into actionable orders
4. **Track positions** - Monitor open trades and manage stops

#### Visibility Logic

```typescript
const isNewUser = positions.length === 0 && orders.length === 0;
```

The card disappears once you have:
- At least one position (open or closed), OR
- At least one order (pending, filled, or cancelled)

#### Styling

- Light blue background (`bg-primary/5`)
- Bordered card (`variant="bordered"`)
- Numbered list for clear sequencing
- Step 1 includes a clickable link to Settings

---

### 3. Quick Start Presets

**Location**: Strategy page (`/strategy`) - **Only visible in Beginner Mode**  
**Component**: `/web-ui/src/pages/Strategy.tsx`

#### What It Does

Provides three pre-configured strategy profiles that beginners can apply with one click:

#### 🛡️ Conservative
- **Risk/Trade**: 1.0%
- **Breakout Lookback**: 60 days
- **Min R:R**: 2.5
- **Best for**: First-time users, capital preservation focus

#### ⚖️ Balanced (Recommended)
- **Risk/Trade**: 1.5%
- **Breakout Lookback**: 50 days
- **Min R:R**: 2.0
- **Best for**: Standard trading with balanced risk/opportunity

#### 🚀 Aggressive
- **Risk/Trade**: 2.0%
- **Breakout Lookback**: 40 days
- **Min R:R**: 1.5
- **Best for**: Experienced traders, more opportunities, requires discipline

#### How to Use

1. Enable Beginner Mode (see above)
2. Scroll to "Quick Start Presets" section
3. Read the description of each preset
4. Click "Apply [Preset Name]" button
5. Review the applied settings
6. Click "Save Changes" to persist

💡 **Tip**: Start with Conservative for your first 20-30 trades while learning the system.

---

### 4. Expandable Help Sections

**Location**: Throughout Strategy page  
**Component**: `/web-ui/src/components/domain/strategy/ExpandableHelp.tsx`

#### What It Does

Each important parameter has an expandable "💡 Why this matters" section that provides:

- **What it is** - Plain-English explanation
- **Why it matters** - Impact on your trading
- **How it affects trades** - Concrete examples
- **Tradeoffs** - What you gain/lose by adjusting it
- **Beginner range** - Safe values for new users
- **Danger zone** - Warning when outside recommended range
- **Pro tips** - Advanced insights for experienced traders

#### How to Use

1. Look for "💡 Why this matters ▼" buttons
2. Click to expand the help section
3. Read the detailed explanation
4. Click again to collapse

#### Available for Parameters

In Beginner Mode, help is available for:
- Risk Per Trade
- Max Position Size
- ATR Multiplier (Stop Distance)
- Breakout Lookback
- Pullback Moving Average

---

### 5. Strategy Safety Score

**Location**: Strategy page (`/strategy`)  
**Component**: `/web-ui/src/pages/Strategy.tsx`

#### What It Does

Real-time safety scoring that evaluates your current strategy configuration and warns about risky settings.

#### Score Ranges

- **🟢 90-100: Beginner Safe**
  - "This configuration follows conservative best practices"
  - All parameters within recommended ranges
  - Safe for new traders

- **🟡 70-89: Use Caution**
  - Some parameters outside ideal ranges
  - Review warnings before proceeding
  - Suitable for traders with some experience

- **🔴 0-69: High Risk**
  - Multiple risky settings detected
  - Not recommended for beginners
  - Requires deep understanding of implications

#### What It Checks

- Risk per trade (warns if >2%)
- Position size concentration (warns if >25%)
- Stop distance (warns if <1.5 ATR or >3.5 ATR)
- Breakout lookback (warns if <30 or >80)
- R:R ratio (warns if <1.5)

---

### 6. Strategy Coach Card

**Location**: Dashboard (`/dashboard`)  
**Component**: `/web-ui/src/components/domain/education/StrategyCoachCard.tsx`

#### What It Does

A collapsible card that provides strategy-specific guidance in plain language. Acts as a "teacher" explaining how the current strategy thinks and makes decisions.

#### Content Sections

- **Strategy philosophy** - Core principles and approach
- **Entry criteria** - What triggers a buy signal
- **Exit rules** - When to take profits or cut losses
- **Risk management** - How capital is protected
- **Common pitfalls** - Mistakes to avoid

#### How to Use

1. Look for "Strategy Coach" card on Dashboard
2. Click "Expand" to see full guidance
3. Click "Collapse" to hide when not needed

---

### 7. Metric Help Labels

**Location**: Throughout the UI (Dashboard, Positions, etc.)  
**Component**: `/web-ui/src/components/domain/education/MetricHelpLabel.tsx`

#### What It Does

Small info icons (ℹ️) next to metrics that provide tooltips explaining:

- What the metric measures
- How it's calculated
- Why it matters for your trading

#### Examples

- **R-Multiple**: "Current gain/loss expressed in units of initial risk (R)"
- **Breakeven R**: "The R level where you'll move stop to entry (lock in breakeven)"
- **Trailing Stop**: "Dynamic stop that follows price upward to protect profits"

---

## Implementation Details

### Technology Stack

- **React Components**: Functional components with TypeScript
- **State Management**: React hooks (useState, useEffect)
- **Styling**: Tailwind CSS with dark mode support
- **i18n**: All text externalized to `/web-ui/src/i18n/messages.en.ts`
- **Content**: Parameter documentation in `/web-ui/src/content/strategy_docs/`

### Key Files

```
web-ui/src/
├── components/domain/
│   ├── strategy/
│   │   ├── BeginnerModeToggle.tsx    # Mode toggle component
│   │   └── ExpandableHelp.tsx        # Parameter help sections
│   └── education/
│       ├── StrategyCoachCard.tsx     # Dashboard guidance
│       └── MetricHelpLabel.tsx       # Inline tooltips
├── pages/
│   ├── Dashboard.tsx                 # Getting Started card
│   └── Strategy.tsx                  # Presets, safety score
├── content/
│   ├── strategy_docs/                # Parameter documentation
│   └── educationGlossary.ts          # Glossary definitions
└── i18n/
    └── messages.en.ts                # All UI text
```

---

## Testing the Features

### Manual Testing Checklist

- [ ] Navigate to Strategy page
- [ ] Toggle between Beginner and Advanced modes
  - [ ] Verify Quick Start Presets appear only in Beginner Mode
  - [ ] Verify Advanced Settings appear only in Advanced Mode
  - [ ] Verify parameter explanations change
- [ ] Apply each Quick Start Preset
  - [ ] Verify settings update correctly
  - [ ] Check Strategy Safety Score updates
- [ ] Expand/collapse help sections
  - [ ] Verify all "Why this matters" sections work
  - [ ] Check content is relevant and helpful
- [ ] Clear positions and orders to see Getting Started card
  - [ ] Verify card appears on Dashboard
  - [ ] Verify links work correctly
  - [ ] Verify card disappears after creating position/order
- [ ] Check Strategy Coach on Dashboard
  - [ ] Verify expand/collapse works
  - [ ] Check content matches active strategy
- [ ] Hover over metric help labels
  - [ ] Verify tooltips appear
  - [ ] Check explanations are clear

### Automated Tests

Tests exist in:
- `/web-ui/src/pages/__tests__/Dashboard.test.tsx`
- `/web-ui/src/pages/__tests__/Strategy.test.tsx`

Run with:
```bash
cd web-ui
npm test
```

---

## Future Enhancements

Potential improvements for the onboarding experience:

1. **Interactive Tour** - Optional step-by-step walkthrough of the UI
2. **Video Tutorials** - Embedded screencasts for visual learners
3. **Practice Mode** - Sandbox environment with simulated data
4. **Achievement System** - Gamification to encourage best practices
5. **Onboarding Checklist** - Track progress through learning milestones
6. **Contextual Tips** - One-time tooltips for first-time actions

---

## Related Documentation

- **[WELCOME.md](../WELCOME.md)** - New contributor onboarding
- **[WEB_UI_GUIDE.md](./WEB_UI_GUIDE.md)** - Complete Web UI documentation
- **[OPERATIONAL_GUIDE.md](./OPERATIONAL_GUIDE.md)** - How to use the system
- **[AGENTS.md](../AGENTS.md)** - Development guidelines and conventions

---

## Support

If you have questions about onboarding features or suggestions for improvements:

1. Check the [documentation index](./README.md)
2. Review the [Web UI Guide](./WEB_UI_GUIDE.md)
3. Open an issue on GitHub
4. Consult the [ROADMAP.md](../ROADMAP.md) for planned features
