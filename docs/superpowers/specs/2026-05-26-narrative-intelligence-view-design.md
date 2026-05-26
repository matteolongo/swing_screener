# Narrative Intelligence View Design

## Goal

Replace the bloated structured data cards in the workspace Overview tab with a narrative-first view when Intelligence has been run for a symbol. Keep the existing tab structure. Give the user a flowing, readable story about what to do and why — with all the detail available on demand.

## Problem

The workspace Overview tab currently shows `DecisionSummaryCard` — a dense grid of badges, bullet lists, and metric tiles that requires scanning to extract meaning. The Intelligence tab shows the LLM narrative but it's plain text, and the two surfaces feel disconnected. Users have to switch tabs to get the full picture.

## Design Decisions

- **Narrative source:** Existing `SymbolIntelligence.narrative` + `summaryLine` from the Intelligence LLM output. No new AI calls.
- **Detail access:** Keep existing tab structure. Detail collapses inside the Overview card.
- **Fallback:** When Intelligence has not been run for a symbol, the existing `DecisionSummaryCard` renders unchanged.

---

## Architecture

### Overview tab — conditional rendering

`SymbolAnalysisContent.tsx` already has access to `intelligenceLatest` (the cached Intelligence result). The condition:

```
if (intelligenceLatest.data) → render NarrativeAnalysisCard
else                         → render DecisionSummaryCard (unchanged)
```

`DecisionSummaryCard` and `TechnicalMetricsGrid` are untouched — they remain the fallback and continue to work as today.

### New component: `NarrativeAnalysisCard`

**File:** `web-ui/src/components/domain/workspace/NarrativeAnalysisCard.tsx`

Props:
```typescript
interface NarrativeAnalysisCardProps {
  intelligence: SymbolIntelligence;
  candidate?: SymbolAnalysisCandidate | null;
  currency?: string;
}
```

Layout (top to bottom):
1. **Action/conviction banner** — same colour-coded banner as `DecisionSummaryCard` (reuse `bannerClass` logic). Uses `intelligence.action` and `intelligence.conviction` (the LLM's read), not `candidate.decisionSummary`. The LLM and screener can disagree; the narrative card always reflects the LLM's assessment.
2. **Narrative body** — `summaryLine` as a bold lead sentence, then `narrative` rendered via `react-markdown` with prose styling.
3. **Compact trade plan strip** — entry/stop/target/RR as 4 tiles (only when `candidate?.decisionSummary?.tradePlan` exists).
4. **Warnings** — amber box, visible (not collapsed) — these are action-critical.
5. **Collapsed detail section** — `<details>` toggle labelled "Signals & detail" containing: technicalLabel / fundamentalsLabel / valuationLabel / catalystLabel badges + valuationContext summary text.

### Markdown rendering

Add `react-markdown` to `web-ui/package.json`. Render `intelligence.narrative` with:
```tsx
<ReactMarkdown className="prose prose-sm prose-slate max-w-none">
  {intelligence.narrative}
</ReactMarkdown>
```

Tailwind `@tailwindcss/typography` plugin is required for `prose` classes. Check if already installed; add if not.

### Backend prompt update

**File:** `src/swing_screener/intelligence/symbol_analyzer.py`, line 23.

Change the narrative instruction from:
```
narrative: full Markdown string with sections ## Why it's moving, ## Key risks, ## Synthetic read
```
To:
```
narrative: flowing prose in Markdown. Use **bold** for key terms and callouts like **What to do:** and **Watch for:** inline. No H1/H2 headings. 3-5 short paragraphs. Max 300 words.
```

This produces a narrative that reads naturally in a card without heavy section headers.

### Intelligence tab changes

**File:** `web-ui/src/components/domain/workspace/IntelligenceCard.tsx`

Remove from the rendered output:
- Action badge + conviction badge (now in Overview banner)
- `summaryLine` paragraph (now Overview lead sentence)
- `narrative` body (now Overview markdown body)

Keep:
- `positionSignal` box
- `upcomingEvents` list
- `sources` collapsible

The Analyze/Refresh button stays in `SymbolAnalysisContent.tsx` at the top of the Intelligence tab — no change.

`CatalystContextCard` stays exactly where it is (before `IntelligenceCard` in the Intelligence tab).

---

## Files Changed

**Create:**
- `web-ui/src/components/domain/workspace/NarrativeAnalysisCard.tsx`
- `web-ui/src/components/domain/workspace/NarrativeAnalysisCard.test.tsx`

**Modify:**
- `web-ui/src/components/domain/workspace/SymbolAnalysisContent.tsx` — conditional NarrativeAnalysisCard vs DecisionSummaryCard in Overview tab
- `web-ui/src/components/domain/workspace/IntelligenceCard.tsx` — remove action/conviction/summaryLine/narrative
- `web-ui/src/components/domain/workspace/IntelligenceCard.test.tsx` — update tests
- `src/swing_screener/intelligence/symbol_analyzer.py` — update narrative prompt instruction
- `web-ui/package.json` — add `react-markdown`
- `web-ui/src/i18n/messages.en.ts` — add "Signals & detail" collapse label

**Possibly modify (if not already present):**
- `web-ui/tailwind.config.js` — add `@tailwindcss/typography` plugin

---

## What Does Not Change

- `DecisionSummaryCard` — untouched, still used as fallback
- `TechnicalMetricsGrid` — untouched, still renders below in Overview
- `CatalystContextCard` — untouched, still in Intelligence tab
- All existing tab labels and navigation
- The chart (`CachedSymbolPriceChart`) — untouched
- Backend models, API schemas, screener logic — no changes
- Today page candidate cards — no changes

---

## Edge Cases

- **No trade plan data** (`candidate` is null): compact strip renders nothing — only narrative + collapsed signals shown.
- **No warnings** (`warningItems` empty): amber box not rendered.
- **Intelligence loading**: `intelligenceLatest.isLoading` is true → show `DecisionSummaryCard` (same as no-data state).
- **Narrative is empty string**: fall back to `DecisionSummaryCard`.

---

## Testing

- `NarrativeAnalysisCard.test.tsx`: renders summaryLine, renders markdown narrative, renders trade plan tiles when candidate present, collapsed details not open by default, warnings visible when present.
- `IntelligenceCard.test.tsx`: verify action/conviction/summaryLine/narrative are no longer rendered; events and position signal still render.
- `SymbolAnalysisContent` integration: when `intelligenceLatest.data` is set, `NarrativeAnalysisCard` renders; when null, `DecisionSummaryCard` renders.
