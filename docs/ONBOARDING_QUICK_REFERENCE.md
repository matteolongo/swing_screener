# Onboarding Features - Quick Reference

## TL;DR

**No modal-based onboarding exists.** Instead, the app uses integrated, contextual education features.

---

## Quick Feature Locations

| Feature | Location | Status |
|---------|----------|--------|
| **Beginner Mode Toggle** | Strategy page (`/strategy`) | ✅ Working |
| **Getting Started Card** | Dashboard (`/dashboard`) - Only for new users | ✅ Working |
| **Quick Start Presets** | Strategy page - Only in Beginner Mode | ✅ Working |
| **Expandable Help** | Strategy page - "💡 Why this matters" buttons | ✅ Working |
| **Strategy Safety Score** | Strategy page - Live scoring 0-100 | ✅ Working |
| **Strategy Coach** | Dashboard - Collapsible guidance card | ✅ Working |
| **Metric Help Labels** | Throughout UI - Info icons with tooltips | ✅ Working |

---

## How to Access Each Feature

### 1. Beginner Mode Toggle
```
1. Navigate to: /strategy
2. Scroll to: "Configuration Mode" card
3. Click: Toggle switch (🎓 / ⚙️)
```

**What changes:**
- Beginner Mode: Simplified UI, Quick Start Presets, extra help
- Advanced Mode: All parameters, regime scaling, advanced settings

---

### 2. Getting Started Card
```
1. Navigate to: /dashboard
2. Condition: Must have 0 positions AND 0 orders
3. Card appears automatically at top
```

**4-Step Guide:**
1. Review/customize strategy
2. Run Screener
3. Create orders
4. Track positions

---

### 3. Quick Start Presets
```
1. Navigate to: /strategy
2. Enable: Beginner Mode
3. Scroll to: "Quick Start Presets"
4. Click: "Apply [Conservative/Balanced/Aggressive]"
```

**Presets:**
- 🛡️ Conservative: 1.0% risk, safest
- ⚖️ Balanced: 1.5% risk, recommended
- 🚀 Aggressive: 2.0% risk, experienced only

---

### 4. Expandable Help
```
1. Navigate to: /strategy
2. Enable: Beginner Mode (more help in this mode)
3. Look for: "💡 Why this matters ▼" buttons
4. Click to expand/collapse
```

**Covers:**
- Risk Per Trade
- ATR Multiplier
- Breakout Lookback
- And more...

---

### 5. Strategy Safety Score
```
1. Navigate to: /strategy
2. Find: "Strategy Safety Score X / 100" card
3. Updates live as you change settings
```

**Score Meanings:**
- 🟢 90-100: Beginner Safe
- 🟡 70-89: Use Caution
- 🔴 0-69: High Risk

---

### 6. Strategy Coach
```
1. Navigate to: /dashboard
2. Find: "Strategy Coach" card
3. Click: "Expand" button
```

**Provides:**
- Strategy philosophy
- Entry/exit criteria
- Risk management approach
- Common pitfalls

---

### 7. Metric Help Labels
```
1. Hover over: Info icons (ℹ️) next to metrics
2. Tooltip appears with explanation
3. Available throughout: Dashboard, Positions, Orders
```

---

## Code Locations

```
web-ui/src/
├── components/domain/
│   ├── strategy/
│   │   ├── BeginnerModeToggle.tsx
│   │   └── ExpandableHelp.tsx
│   └── education/
│       ├── StrategyCoachCard.tsx
│       └── MetricHelpLabel.tsx
├── pages/
│   ├── Dashboard.tsx (lines 482-500: Getting Started)
│   └── Strategy.tsx (Presets, Safety Score)
└── content/
    └── strategy_docs/ (Parameter docs)
```

---

## Testing Checklist

Quick manual test to verify all features work:

```
□ Strategy page → Toggle Beginner/Advanced mode
□ Strategy page → Apply Quick Start Preset
□ Strategy page → Expand "Why this matters" section
□ Strategy page → Check Safety Score updates
□ Dashboard → Verify Strategy Coach expands
□ Dashboard → (If new user) See Getting Started card
□ Any page → Hover info icon to see tooltip
```

---

## For More Details

See **[ONBOARDING_FEATURES.md](./ONBOARDING_FEATURES.md)** for comprehensive documentation.

---

## Summary for Users

**There is no modal to open/close.** The onboarding experience is:

1. **Integrated** - Help is built into the UI
2. **Progressive** - Beginner Mode simplifies everything
3. **Contextual** - Guidance appears where relevant
4. **Opt-in** - Users dig deeper when ready

**Recommended for new users:**
1. Enable Beginner Mode on Strategy page
2. Apply "Balanced" Quick Start Preset
3. Read the "Why this matters" sections
4. Keep Strategy Safety Score above 90
5. Follow the Getting Started card on Dashboard
