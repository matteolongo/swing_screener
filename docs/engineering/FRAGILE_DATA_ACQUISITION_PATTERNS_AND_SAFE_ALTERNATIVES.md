# Fragile Data Acquisition Patterns And Safe Alternatives

Last updated: 2026-03-19

Related document:
[DATA_SOURCE_AUDIT_AND_PROVIDER_STRATEGY.md](/Users/matteo.longo/projects/randomness/trading/swing_screener/docs/engineering/DATA_SOURCE_AUDIT_AND_PROVIDER_STRATEGY.md)

## Purpose

This document explains which data-acquisition patterns we should not build around, why they fail in practice, and what to do instead.

It is intentionally defensive. It does **not** describe how to perform session-cookie replay, private API piggybacking, token extraction, authenticated scraping, or anti-bot bypass. If a data source only works when we impersonate a logged-in browser, that is a product-risk signal, not an engineering shortcut.

## Policy Boundary

Allowed acquisition classes for this repo:

- official APIs
- public regulator / exchange / company feeds
- public RSS / Atom feeds
- public HTML scraping only when robots and ToS checks pass
- user-provided exports
- broker / vendor integrations with explicit auth or partner access

Rejected acquisition classes:

- session-cookie replay
- private API piggybacking
- browser token reuse
- authenticated scraping against user sessions
- mobile-app API imitation that depends on hidden credentials or unstable signed requests
- captcha or anti-bot bypass

This matches the repo’s current source model and scrape guardrails in
[src/swing_screener/intelligence/config.py](/Users/matteo.longo/projects/randomness/trading/swing_screener/src/swing_screener/intelligence/config.py#L17),
[src/swing_screener/intelligence/evidence.py](/Users/matteo.longo/projects/randomness/trading/swing_screener/src/swing_screener/intelligence/evidence.py#L340),
and
[data/intelligence/domain_policies.json](/Users/matteo.longo/projects/randomness/trading/swing_screener/data/intelligence/domain_policies.json#L1).

## Why Teams Reach For Fragile Patterns

These patterns usually appear when one of these is true:

- the needed data is behind a login but there is no clean integration yet
- the official API exists but is expensive
- the public site looks easier to automate than the official partner process
- the product wants breadth immediately and accepts hidden operational debt

That trade is almost always wrong for a data product. Hidden acquisition debt becomes:

- random outages
- silent schema breakage
- legal and account risk
- impossible support/debugging
- no clean path to production or commercial use

## Red-Line Patterns And Replacements

| Pattern | Why it is fragile | What usually breaks | Safe replacement |
| --- | --- | --- | --- |
| Session-cookie replay | Depends on stealing or reusing browser state that was never meant to be our service credential | cookie expiry, MFA challenges, IP/device checks, legal/account issues | official API, vendor partnership, user export import, or do not support the source |
| Private API piggybacking | Ties us to undocumented endpoints and hidden request contracts | schema drift, anti-bot changes, blocked keys, unexplained bans | official API, paid aggregator, or public-source reconstruction |
| Browser token reuse from local storage / network traffic | Treats a front-end credential as backend integration auth | rotation, origin binding, account lockouts, severe support risk | OAuth, partner auth, explicit user key entry, or export-based workflow |
| Authenticated scraping of logged-in pages | Assumes the website UI is a stable machine interface | DOM changes, captcha, account challenges, session expiry | exported CSV/PDF import, public endpoints, or broker plugin/integration |
| Mobile-app API imitation | Usually depends on hidden app behavior, signed requests, or pinned clients | app updates, app attestation, signing changes, account blocks | official mobile/backend API program, vendor access, or unsupported |
| Anti-bot or captcha bypass | Converts the data problem into an adversarial arms race | bans, broken jobs, compliance exposure | slower public feeds, partner access, or reduced product scope |

## Repo-Specific Safe Patterns

### 1. Use primary-source public disclosures first

For this app, the highest-value free data is already in public disclosures:

- SEC submissions and XBRL facts
- company IR RSS and newsroom feeds
- exchange announcement feeds
- public RSS catalogs for supporting news evidence

The repo already has machinery for this:

- source enablement and scrape flags in [src/swing_screener/intelligence/config.py](/Users/matteo.longo/projects/randomness/trading/swing_screener/src/swing_screener/intelligence/config.py#L17)
- feed discovery and caching in [src/swing_screener/intelligence/evidence.py](/Users/matteo.longo/projects/randomness/trading/swing_screener/src/swing_screener/intelligence/evidence.py#L340)
- robots/ToS/domain policy checks in [src/swing_screener/intelligence/evidence.py](/Users/matteo.longo/projects/randomness/trading/swing_screener/src/swing_screener/intelligence/evidence.py#L548)

### 2. Prefer explicit user-owned export flows over implicit session reuse

If data is available only inside a broker/account portal:

- ask for CSV, JSON, or PDF export
- build an importer
- make the user trigger the export explicitly
- store provenance and import timestamps

Do **not** build hidden acquisition around a browser session. If a user owns the data, explicit export is the lowest-risk bridge until a real integration exists.

### 3. Treat public scraping as transparent fallback, not hidden primary source

Public HTML scraping is acceptable only when all of these are true:

- the page is public
- robots allow access
- ToS/domain policy allow access
- request rates are low and cached
- failure is visible and non-catastrophic
- there is an explicit owner for maintaining selectors/parsers

The repo already encodes that posture:

- `scraping_enabled` is off by default
- `require_robots_allow` is on by default
- `require_tos_allow_flag` is on by default

See [src/swing_screener/intelligence/config.py](/Users/matteo.longo/projects/randomness/trading/swing_screener/src/swing_screener/intelligence/config.py#L80).

### 4. Split domain responsibility instead of forcing one source to do everything

The clean replacement for fragile patterns is usually domain separation:

- price / OHLCV: market-data vendor
- fundamentals: regulator filings plus normalized provider
- corporate events: specialist calendar or public primary sources
- news: licensed news plus IR/exchange support
- identifiers: security-master service

Trying to squeeze all of that through one unofficial path is what creates brittle systems.

## “What Should We Do Instead?” By Need

| Need | Do this instead of fragile acquisition |
| --- | --- |
| US filings / fundamentals | Build from `SEC EDGAR/XBRL`; use a commercial normalizer only as secondary convenience |
| EU/global fundamentals | Use a vendor such as `EODHD` or `Twelve Data`; for priority names, supplement with issuer reports |
| US price / intraday | Use `Polygon` or `Alpaca`; keep `yfinance` and `Stooq` only as convenience backstops |
| Corporate events | Use `Wall Street Horizon`, `SEC`, company IR RSS, and exchange feeds |
| News / catalysts | Use licensed news plus IR/exchange/public RSS; do not depend on hidden web APIs |
| Security master | Add `OpenFIGI` and keep repo overrides for edge cases |
| Broker or account data | Use official broker API or user export/import flow |

## Decision Checklist

Before adding a new source, answer these questions:

1. Is the source public, official, and documented?
2. If not official, is it at least public and explicitly allowed by robots/ToS?
3. If the source requires login, is there an official API or explicit export flow?
4. Can we explain the credential model to another engineer in one sentence without hand-waving?
5. Can the source fail openly, or will it fail silently and corrupt analysis?
6. Is there a primary / secondary / fallback story for this data domain?

If the answer to `3` or `4` is “no,” stop. Do not build the integration as a hidden session or private-API dependency.

## Signals That A Source Is Not Production-Safe

- It only works in a personal browser.
- It depends on copying cookies, headers, or device fingerprints.
- It breaks when the site logs out, adds MFA, or changes UI markup.
- The request path is undocumented and not meant for third parties.
- The vendor does not want the path used this way.
- We cannot clearly state who owns the account or credential.
- We cannot tell whether the data is delayed, sampled, incomplete, or legally reusable.

Any one of these is enough to downgrade the source to `research only` or reject it entirely.

## Engineering Replacements To Prefer

When a fragile idea comes up, prefer one of these moves:

- shrink the feature so it fits an official source
- buy one narrow commercial feed instead of scraping five shaky ones
- ask the user for an export instead of reusing their live session
- use public company/regulator disclosures and reconstruct the needed fields
- keep a manual-review path for hard-to-source data rather than faking automation
- make unsupported sources explicit in product scope

## Suggested Internal Classification

For future source reviews, use these labels:

- `official`
- `aggregated commercial`
- `public web`
- `unofficial`
- `rejected`

And pair them with one operational status:

- `primary`
- `secondary`
- `fallback`
- `research only`
- `do not use`

## Recommended Follow-Up

- Keep [DATA_SOURCE_AUDIT_AND_PROVIDER_STRATEGY.md](/Users/matteo.longo/projects/randomness/trading/swing_screener/docs/engineering/DATA_SOURCE_AUDIT_AND_PROVIDER_STRATEGY.md) as the source-selection document.
- Use this document as the red-line policy when new “free” acquisition ideas come up.
- If a future integration proposal depends on login replay, hidden endpoints, or anti-bot evasion, reject it and redesign the feature boundary instead.
