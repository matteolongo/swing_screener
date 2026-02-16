# M1: Visual UI Changes Guide

## Sidebar Mode Toggle (Footer Section)

### Before
```
┌─────────────────────────────┐
│                             │
│  [Nav Items]                │
│                             │
│                             │
├─────────────────────────────┤
│  v0.1.0                     │
│  Risk-first swing trading   │
└─────────────────────────────┘
```

### After
```
┌─────────────────────────────┐
│                             │
│  [Nav Items]                │
│                             │
│                             │
├─────────────────────────────┤
│  Mode              [  ○  ]  │  ← Toggle Switch
│  Beginner                   │  ← Current Mode Label
├─────────────────────────────┤
│  v0.1.0                     │
│  Risk-first swing trading   │
└─────────────────────────────┘
```

## Navigation States

### Beginner Mode (Default)
```
┌─────────────────────────────┐
│  Dashboard         [Active] │ ← Enabled
│  Daily Review      [Active] │ ← Enabled
│  Screener          [Active] │ ← Enabled
│  Backtest          [Grayed] │ ← DISABLED (with tooltip)
│  Orders            [Active] │ ← Enabled
│  Positions         [Active] │ ← Enabled
│  Strategy          [Active] │ ← Enabled
│  Settings          [Active] │ ← Enabled
└─────────────────────────────┘

When hovering over Backtest:
  → Shows tooltip: "Enable Advanced Mode to access"
```

### Advanced Mode
```
┌─────────────────────────────┐
│  Dashboard         [Active] │ ← Enabled
│  Daily Review      [Active] │ ← Enabled
│  Screener          [Active] │ ← Enabled
│  Backtest          [Active] │ ← NOW ENABLED
│  Orders            [Active] │ ← Enabled
│  Positions         [Active] │ ← Enabled
│  Strategy          [Active] │ ← Enabled
│  Settings          [Active] │ ← Enabled
└─────────────────────────────┘

All navigation items are fully enabled and clickable
```

## Toggle Interaction

### Toggle Switch States
```
Beginner Mode ON (default for new users):
  [○     ]  ← Switch position left, gray background
  
Advanced Mode ON:
  [     ○]  ← Switch position right, primary color background
```

### Click Behavior
- Click switch → Toggle mode
- Mode persists in localStorage
- Page does not reload
- Navigation items update immediately

## Disabled Navigation Behavior

When a nav item is disabled (Beginner Mode):
1. **Visual**: Text color changes to gray-400
2. **Cursor**: Shows `cursor-not-allowed`
3. **Click**: preventDefault() - navigation does not occur
4. **Tooltip**: Hover shows "Enable Advanced Mode to access"
5. **Accessibility**: Still in DOM and visible (not hidden)

## LocalStorage Keys

The implementation uses these localStorage keys:
- `swing-screener-beginner-mode` → Stores mode preference
- `swing-screener-onboarding` → Stores onboarding progress

## Color Scheme

### Mode Toggle
- **Beginner (OFF position)**: Gray background (`bg-gray-300`)
- **Advanced (ON position)**: Primary color background (`bg-primary`)
- **Switch knob**: White (`bg-white`)

### Navigation Items
- **Active/Enabled**: Primary text color, hover background
- **Disabled**: `text-gray-400 dark:text-gray-600`
- **Hovered (enabled)**: `hover:bg-gray-100 dark:hover:bg-gray-700`
- **Hovered (disabled)**: Shows tooltip, no background change

## Responsive Design

The mode toggle adapts to dark mode:
- Light mode: Gray and primary colors
- Dark mode: Darker grays for disabled items
- Tooltip: Dark background (`bg-gray-900`) in both modes

## Keyboard Accessibility

- Toggle switch is a `<button>` element
- Accessible label: "Toggle between Beginner and Advanced mode"
- Focus ring on keyboard focus: `focus:ring-2 focus:ring-primary`
- Enter/Space to toggle

## Integration Points for Future Milestones

### M2: Guided Daily Flow
The stores are ready for:
- Onboarding modal to consume `useOnboardingStore()`
- Dashboard to check `isBeginnerMode` for "Today's Next Action"
- Daily Review to use `useStrategyReadiness()` for blocker cards

### M3: Simplification
Pages can now check:
```typescript
const { isBeginnerMode } = useBeginnerModeStore();

// Conditional rendering based on mode
{isBeginnerMode ? <SimplifiedView /> : <AdvancedView />}
```

## Testing Coverage

Visual states tested:
- ✅ Toggle renders correctly
- ✅ Mode label updates on toggle
- ✅ Disabled nav items show correct styling
- ✅ Click on disabled items is prevented
- ✅ Mode persists across component remounts
- ✅ All 8 navigation items render
