# Issue Proposals

This directory contains adapted issue proposals and implementation guides for potential features.

## Purpose

When GitHub issues contain proposals that need to be adapted to fit Swing Screener's architecture and philosophy, the adapted versions are stored here for:

1. **Detailed planning** before implementation
2. **Architecture documentation** aligned with the project
3. **Discussion reference** for stakeholders
4. **Historical record** of proposal evolution

## Files

### Current Proposals

- **`llm_market_intelligence_adapted.md`** - Short issue description for LLM-augmented intelligence layer
  - Companion doc: `../LLM_INTELLIGENCE_IMPLEMENTATION.md` (full implementation guide)
  - Status: Proposal stage, not implemented
  - Adapts original proposal to work with existing `src/swing_screener/intelligence/` architecture

## Format

Each proposal should include:

1. **Summary** - What problem does this solve?
2. **Current Architecture** - What exists today?
3. **Proposed Enhancement** - What changes?
4. **Design Principles** - How does it align with project philosophy?
5. **Implementation Phases** - Sequenced work breakdown
6. **Risks & Mitigations** - What could go wrong?
7. **Acceptance Criteria** - What does "done" look like?

## Relationship to ROADMAP.md

- `ROADMAP.md` - High-level feature status and priorities
- `docs/issues/` - Detailed proposals for planned features

Proposals here are referenced in ROADMAP.md under the "📋 Planned" section.

## When to Create a Proposal Here

Create a proposal in `docs/issues/` when:

✅ The GitHub issue is complex and needs architectural planning  
✅ The proposal needs adaptation to fit the existing codebase  
✅ Multiple implementation approaches need comparison  
✅ The change affects multiple subsystems  
✅ The feature is controversial or needs justification  

Do NOT create a proposal here for:

❌ Simple bug fixes  
❌ Straightforward feature additions  
❌ Documentation-only changes  
❌ Refactors that don't change behavior  

---

_For questions about proposals, see the project maintainer or discuss in GitHub issues._
