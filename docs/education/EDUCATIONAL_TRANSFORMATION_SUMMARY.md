# Educational Transformation Summary

> Status: snapshot.  
> Last reviewed: 2026-02-17.

## Purpose
Document the education-first strategy UX and where the supporting data and components live.

## What Exists Today
- Strategy documentation content lives in `web-ui/src/content/strategy_docs/` (for example `momentum.json`).
- Strategy page renders philosophy and educational fields using components in `web-ui/src/components/domain/strategy/`.
- Educational field controls read parameter docs and show guidance, warnings, and badges.
- Recommended-trade beginner documentation now lives in `docs/education/RECOMMENDED_LOGIC_BEGINNER_GUIDE.md`.
- English companion copy lives in `docs/education/RECOMMENDED_LOGIC_BEGINNER_GUIDE_EN.md`.
- Short-form UI/onboarding copy lives in `docs/education/RECOMMENDED_LOGIC_UI_COPY.md`.

## Key Files
- `web-ui/src/content/strategy_docs/momentum.json`
- `web-ui/src/content/strategy_docs/loader.ts`
- `web-ui/src/components/domain/strategy/StrategyPhilosophyCard.tsx`
- `web-ui/src/components/domain/strategy/EducationalFieldControls.tsx`
- `web-ui/src/components/domain/strategy/ExpandableHelp.tsx`
- `web-ui/src/pages/Strategy.tsx`
- `docs/education/RECOMMENDED_LOGIC_BEGINNER_GUIDE.md`
- `docs/education/RECOMMENDED_LOGIC_BEGINNER_GUIDE_EN.md`
- `docs/education/RECOMMENDED_LOGIC_UI_COPY.md`

## Notes
This summary is intentionally minimal. For UI behavior, consult the Strategy page and the component implementations listed above.
