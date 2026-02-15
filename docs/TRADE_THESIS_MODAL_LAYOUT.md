# Trade Thesis Modal - Visual Layout

> **Status: Historical snapshot (February 2026).** This layout document describes the original thesis modal design and may not match the current UI composition.

This document describes the visual layout of the Trade Thesis Modal.

## Modal Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  Trade Thesis: AAPL                                        [X]  │
│  Momentum Strategy                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────────────┐   │
│  │ Setup Quality Score  │  │ Trade Safety                 │   │
│  │                      │  │                              │   │
│  │      88 /100         │  │  🟢 Beginner-Friendly       │   │
│  │                      │  │      Setup                   │   │
│  │  HIGH_QUALITY        │  │                              │   │
│  └──────────────────────┘  │  Beginner-friendly          │   │
│                             └──────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 📊 Trade Personality                                     │  │
│  │                                                          │  │
│  │  Trend Strength        ⭐⭐⭐⭐⭐                        │  │
│  │  Volatility Control    ⭐⭐⭐⭐☆                        │  │
│  │  System Conviction     ⭐⭐⭐⭐☆                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ✅ Why This Trade Appeared                               │  │
│  │                                                          │  │
│  │  • Stock is in confirmed uptrend (above 20/50/200 SMA)  │  │
│  │  • Outperforming the market benchmark                   │  │
│  │  • Both breakout and pullback signals active            │  │
│  │  • Volatility is within controlled levels               │  │
│  │  • Risk/Reward (3.0:1) exceeds minimum threshold        │  │
│  │                                                          │  │
│  │  👉 This is a Momentum Continuation Setup               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ⚠️ What Could Go Wrong                     [YELLOW BG]  │  │
│  │                                                          │  │
│  │  • Breakouts can fail in weak market regimes            │  │
│  │  • If volatility expands, stop distance increases       │  │
│  │  • Momentum strategies depend on trend persistence      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 💡 Professional Insight                    [BLUE BG]    │  │
│  │                                                          │  │
│  │  This trade is based on sustained strength rather than  │  │
│  │  anticipation. The stock is proving demand by making    │  │
│  │  new highs while outperforming the broader market.      │  │
│  │  Controlled volatility allows for a clearly defined     │  │
│  │  stop for risk management.                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ❌ This Trade Is No Longer Valid If:       [RED BG]     │  │
│  │                                                          │  │
│  │  → Price closes below stop level ($145.00)              │  │
│  │     Monitor: close threshold at 145.0                   │  │
│  │                                                          │  │
│  │  → Price closes back below breakout level ($150.00)     │  │
│  │     Monitor: close threshold at 150.0                   │  │
│  │                                                          │  │
│  │  → Relative strength weakens significantly vs SPY       │  │
│  │     Monitor: rel_strength threshold at -0.1             │  │
│  │                                                          │  │
│  │  → Price breaks below SMA50 with high volume            │  │
│  │                                                          │  │
│  │  → Market regime shifts to risk-off (defensive          │  │
│  │     rotation)                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 📋 Trade Characteristics                                 │  │
│  │                                                          │  │
│  │  Entry Type:        Breakout + Pullback                 │  │
│  │  Trend Status:      Strong                              │  │
│  │  Relative Strength: Outperforming                       │  │
│  │  Volatility:        Low                                 │  │
│  │                                                          │  │
│  │  Risk/Reward:       3.0:1                               │  │
│  │  Price Action:      Clean                               │  │
│  │  Regime Aligned:    Yes                                 │  │
│  │  Institutional:     Yes                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  This is transparent, rule-based reasoning. No AI               │
│  hallucination.                                   [Close]       │
└─────────────────────────────────────────────────────────────────┘
```

## Color Coding

- **Setup Score Card**: White background, blue accents
- **Safety Label Card**: White background, badge with 🟢🟡🔴 colors
- **Trade Personality**: White background, yellow stars
- **Why Appeared**: White background, green accents
- **What Could Go Wrong**: Yellow/amber background (#FEF3C7)
- **Professional Insight**: Blue background (#EFF6FF)
- **Invalidation Rules**: Red/pink background (#FEE2E2)
- **Characteristics**: White background, organized grid

## Typography

- **Section Headers**: Bold, 16px
- **Scores/Values**: Large (32-48px for score), bold
- **Body Text**: 14px, gray-700
- **Bullet Points**: Green/Yellow/Red bullets matching section theme

## Icons

- 🎯 Setup Score (Target icon)
- 🛡️ Safety (Shield icon)
- ⭐ Star ratings
- ✅ Why qualified (checkmark)
- ⚠️ Risks (warning triangle)
- 💡 Insight (lightbulb)
- ❌ Invalidation (cross/X)
- 📋 Characteristics (clipboard)

## Spacing

- Modal padding: 24px
- Section spacing: 24px between cards
- Card padding: 16px
- Line height: 1.5

## Interactions

- **Scrollable**: Main content area scrolls if needed
- **No tabs**: Single flow for learning
- **Close button**: Top-right X
- **Footer button**: Primary blue "Close" button

## Responsive

- **Desktop**: Max-width 1024px
- **Tablet**: Stacks score cards vertically
- **Mobile**: Full-width, single column

---

## Example Values

**High-Quality Setup:**
- Score: 88
- Tier: HIGH_QUALITY
- Safety: 🟢 Beginner-Friendly
- Trend: ⭐⭐⭐⭐⭐
- Volatility: ⭐⭐⭐⭐☆
- Conviction: ⭐⭐⭐⭐☆

**Weak Setup:**
- Score: 45
- Tier: WEAK
- Safety: 🔴 Advanced Only
- Trend: ⭐⭐☆☆☆
- Volatility: ⭐☆☆☆☆
- Conviction: ⭐⭐☆☆☆

---

**Implementation:** React + TypeScript + Tailwind CSS  
**Component:** `web-ui/src/components/modals/TradeThesisModal.tsx`
