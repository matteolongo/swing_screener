# Design tokens (clean-console dark theme)

The web UI is **dark-only** and **token-driven**. Every color comes from a semantic
design token defined in `src/index.css` (`:root`) and bridged to Tailwind in
`tailwind.config.js` via `hsl(var(--x))`. Do not hardcode Tailwind color literals
(`bg-gray-800`, `text-blue-600`, `bg-green-100`, …) or `dark:` variants in component
`className`s. The ESLint rule `no-restricted-syntax` enforces this.

## Tokens

| Token classes | Use |
|---|---|
| `bg-background` | app background |
| `bg-surface` | panels, cards, raised rows, inputs |
| `text-foreground` | primary text |
| `text-muted` | secondary / label text |
| `border-border`, `divide-border` | hairlines |
| `bg-primary`, `text-primary`, `text-primary-foreground`, `border-primary/40` | the single interactive accent (indigo): active nav, primary buttons, links, focus rings, info |
| `text-success`, `bg-success`, `bg-success/10`, `text-success-foreground` | R / P&L positive, wins, "good" state |
| `text-danger`, `bg-danger`, `bg-danger/10` | R / P&L negative, losses, destructive |
| `text-warning`, `bg-warning`, `bg-warning/10`, `border-warning/40` | caution: time-stop, update-stop, validation warnings |

**Color is signal.** `success`/`danger`/`warning` are reserved for value sign and risk
state. `primary` is reserved for interactivity. Neutrals carry everything else.

Helpers: `getSignColorClass(value)` returns `text-success`/`text-danger`; `<RChip value=>`
renders a signed R-multiple in tabular mono with the right sign token.

## Values

| Token | HSL | Hex |
|---|---|---|
| `--background` | `220 14% 7%` | `#0F1114` |
| `--foreground` | `220 15% 92%` | `#E7E9EE` |
| `--muted` | `220 10% 63%` | `#959CA8` |
| `--border` | `220 10% 17%` | `#272A30` |
| `--surface` | `220 12% 10%` | `#16181D` |
| `--primary` | `233 76% 71%` | `#8290EE` |
| `--primary-foreground` | `220 14% 7%` | `#0F1114` |
| `--success` | `155 45% 51%` | `#48BD8B` |
| `--success-foreground` | `220 14% 8%` | `#121317` |
| `--warning` | `42 70% 56%` | `#DDB040` |
| `--warning-foreground` | `42 80% 12%` | `#372806` |
| `--danger` | `9 78% 61%` | `#EA6950` |
| `--danger-foreground` | `0 0% 100%` | `#FFFFFF` |
| `--radius` | — | `0.5rem` |

**Typography:** body uses system sans (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif`); numerics and code use `JetBrains Mono`.

## Migration map (Tailwind literal -> token)

Applied when collapsing the legacy paired (`light dark:`) utilities. Drop the `dark:`
half; the app is dark-only.

| Legacy family | role | token |
|---|---|---|
| `gray`/`slate`/`zinc` `bg-white`/`-50`/`-100` | surface | `bg-surface` (preserve `/opacity`) |
| `gray`/`slate` `text-900`/`-800` | primary text | `text-foreground` |
| `gray`/`slate` `text-700`/`-600`/`-500`/`-400` | secondary text | `text-muted` |
| `gray`/`slate` `border-*`, `divide-*` | hairline | `border-border` / `divide-border` |
| gray hovers (`hover:bg-gray-50/100`) | hover | `hover:bg-foreground/5` |
| `blue`/`sky`/`indigo` `-50`/`-100` bg | accent tint | `bg-primary/10` |
| `blue`/`sky`/`indigo` `text-600..900` | accent text | `text-primary` |
| `blue`/`sky`/`indigo` `border-*` | accent border | `border-primary/40` |
| `blue` `-500`/`-600` solid + `text-white` | solid accent | `bg-primary text-primary-foreground` |
| `blue`/`sky` focus (`ring`/`focus:ring`/`focus:border`) | focus | `ring-primary` / `focus:ring-primary` / `focus:border-primary/40` |
| `green`/`emerald` `-50`/`-100` bg | positive tint | `bg-success/10` |
| `green`/`emerald` `text-600..800` | positive text | `text-success` |
| `green`/`emerald` `-500`/`-600` solid | positive solid | `bg-success text-success-foreground` |
| `red`/`rose` `-50`/`-100` bg | negative tint | `bg-danger/10` |
| `red`/`rose` `text-*` | negative text | `text-danger` |
| `amber`/`yellow` `-50`/`-100` bg | caution tint | `bg-warning/10` |
| `amber`/`yellow` `text-*` | caution text | `text-warning` |
| `amber`/`yellow` `border-*` | caution border | `border-warning/40` |

Charts (`CandleChart` SVG series fill/stroke) keep their own scale and are exempt; so is
the brand-mark gradient.
