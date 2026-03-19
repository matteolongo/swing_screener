# Combined Technical + Fundamental Analysis Reasoning

> Status: handoff-ready proposal.
> Last reviewed: 2026-03-19.

## 1. Why this feature should exist

Today the product already gives the user several partial answers:

- the screener tells the user whether a setup is technically interesting;
- the workspace/order flow tells the user how to enter and where risk sits;
- fundamentals tell the user whether the company quality is attractive or fragile;
- intelligence/catalyst analysis tells the user whether there is a fresh reason the symbol matters now.

What is still missing is a **single symbol-level summary** that combines those layers into a short, interpretable answer.

The feature should help the user answer five practical questions immediately:

1. **Should I care about this symbol today?**
2. **Is the business quality strong enough to increase conviction?**
3. **Is the setup actionable now or should I wait?**
4. **Is the current price attractive, fair, or stretched?**
5. **What is the most sensible next action right now?**

The point is **not** to replace user judgment and **not** to emit black-box advice. The point is to compress the data the app already has into a compact, educational decision summary.

---

## 2. The core product principle

The app should **not** merge everything into one opaque score.

Instead, it should keep four distinct layers visible:

1. **Technical readiness** — is the chart/setup ready?
2. **Fundamental quality** — is the business quality attractive?
3. **Valuation context** — is the stock cheap, fair, or expensive?
4. **Catalyst/context** — is there a fresh market reason this symbol matters now?

This separation matters because users do not think in a single dimension. They need to understand where the edge is coming from and where the weakness is.

### Examples of why separation matters

- A **strong business** can still be **too expensive**.
- A **strong chart** can still be backed by **weak fundamentals**.
- A **cheap stock** can still be **technically broken**.
- A **fresh catalyst** can matter even if fundamentals are only neutral.

So the summary should explain the *combination* of factors, not hide them.

---

## 3. What each study should answer

### Technical analysis answers

Technical analysis should answer:

- Is the setup ready now?
- What is the entry?
- What is the stop/invalidation?
- Is the reward/risk acceptable?
- Is the stock showing trend leadership or not?

This is the layer that answers **when to buy** and **at what trade price to buy**.

### Fundamental analysis answers

Fundamentals should answer:

- Is this a strong business or a fragile one?
- Are growth, margins, cash generation, and balance sheet supportive?
- Are there structural warnings that should lower conviction?

This is the layer that answers **whether the symbol deserves higher conviction**, not whether the user should buy this exact candle.

### Valuation answers

Valuation should answer:

- Is the price currently cheap, fair, or expensive versus available fundamentals?
- If the stock is high quality, is the current price still acceptable?
- If the setup is technically strong, is the user at risk of overpaying?

This layer should stay separate from business quality.

### Catalyst/context answers

Catalyst/context should answer:

- Why is this symbol relevant now?
- Is the catalyst fresh and well-supported?
- Is the symbol in an active state, a trending continuation state, or just an early watch state?

This layer answers **why now**.

---

## 4. The mental model we want the user to have

The user should be able to scan one symbol and mentally process this sequence:

1. **Quality** — “Do I like the business?”
2. **Timing** — “Is the setup ready?”
3. **Price** — “Am I paying a fair or stretched price?”
4. **Context** — “Why is this symbol relevant now?”
5. **Action** — “What should I do next?”

If the summary is designed well, the user should be able to open a symbol and decide in a few seconds whether it belongs in one of four buckets:

- act now;
- wait for a better entry;
- keep on watchlist;
- avoid for now.

---

## 5. Recommended top-level output

The system should output a **decision state**, not a vague recommendation score.

Recommended states:

- `BUY_NOW`
- `BUY_ON_PULLBACK`
- `WAIT_FOR_BREAKOUT`
- `WATCH`
- `TACTICAL_ONLY`
- `AVOID`
- `MANAGE_ONLY`

These are easy to understand, easy to test, and match the way a swing trader actually thinks.

---

## 6. How the layers should be combined

### Pattern A — strong technicals + strong fundamentals + acceptable valuation

Interpretation:

- high-conviction candidate;
- setup is ready;
- business quality supports holding conviction;
- valuation is not an immediate blocker.

Recommended state:

- `BUY_NOW`

### Pattern B — strong technicals + strong fundamentals + expensive valuation

Interpretation:

- still interesting;
- business and chart are both strong;
- user should avoid chasing and prefer a pullback or very disciplined breakout.

Recommended state:

- `BUY_ON_PULLBACK`

### Pattern C — strong fundamentals + weak/incomplete technicals

Interpretation:

- good business;
- bad or incomplete timing;
- valid watchlist candidate, not an immediate trade.

Recommended state:

- `WATCH`

### Pattern D — strong technicals + weak fundamentals

Interpretation:

- there may be a tactical trade;
- it should not be presented as a high-conviction quality setup;
- conviction and holding assumptions should stay lower.

Recommended state:

- `TACTICAL_ONLY`

### Pattern E — weak technicals + weak fundamentals

Interpretation:

- no clear edge;
- low attention priority.

Recommended state:

- `AVOID`

### Pattern F — active catalyst + decent technicals + neutral fundamentals

Interpretation:

- event-driven interest exists;
- this can still be a real opportunity;
- confirmation matters more than static quality.

Recommended state:

- usually `WATCH` or `WAIT_FOR_BREAKOUT`

---

## 7. What “when to buy” means in this app

The product should treat **when to buy** as a technical-execution question.

It should come from:

- entry;
- stop;
- target;
- reward/risk;
- technical readiness / confidence;
- current price vs planned setup.

Fundamentals should influence **priority and conviction**, not replace entry timing.

---

## 8. What “at what price to buy” means in this app

The app should explicitly separate two price concepts.

### A. Trade entry price

This is the operational setup price:

- breakout level;
- pullback zone;
- entry used for RR and sizing.

### B. Value / fair-value context

This is the valuation context:

- cheap;
- fair;
- expensive;
- optionally a fair-value range.

These are related but not interchangeable.

A stock can have:

- a valid technical entry;
- but still be expensive versus fundamentals.

The UI should make that mismatch visible instead of hiding it.

---

## 9. Fair value and book-value metrics

### Fair value

Yes, the app can calculate fair value, but the first version should be simple and explainable.

Recommended rollout:

1. **heuristic valuation label** based on current metrics;
2. **relative fair value** versus simple ranges / history / peers;
3. **fair value range** (`low`, `base`, `high`) when enough data exists.

The first version should avoid a complex DCF and prefer methods that are deterministic, robust, and easy to explain in the UI.

### Price-to-book / book-to-price

Yes, but these need extra raw fields that are not central in the current snapshot contract.

Needed inputs:

- total equity;
- shares outstanding;
- book value per share;
- price to book;
- book to price.

These metrics should be used selectively because they matter much more for some sectors than for others.

---

## 10. The right kind of insights to extract

The summary should produce a few compact insights, not a wall of metrics.

Recommended insight categories:

### Priority insight
“Should I spend attention on this symbol today?”

### Timing insight
“Act now, wait, or avoid chasing?”

### Quality insight
“Is this a strong business-backed setup or only a tactical trade?”

### Valuation insight
“Is the current price cheap, fair, or expensive?”

### Risk insight
“What is the main reason to be cautious?”

### Mismatch insight
“Where do the studies disagree?”

Mismatch insight is especially valuable. Typical examples:

- strong business, weak chart;
- weak business, strong chart;
- strong chart, expensive valuation;
- fresh catalyst, but incomplete fundamental support.

---

## 11. What the top summary card should show

The UI should present a compact **Decision Summary** card at the top of the symbol analysis experience.

### Header

- symbol;
- decision state;
- conviction badge.

### Signal row

- technical: strong / neutral / weak;
- fundamentals: strong / neutral / weak;
- valuation: cheap / fair / expensive;
- catalyst: active / neutral / weak.

### Execution row

- entry;
- stop;
- target;
- RR.

### Summary copy

- **Why this stands out**;
- **What to do now**;
- **Main risk**.

### Optional warning area

- stale fundamentals;
- partial coverage;
- low data quality;
- missing valuation context.

---

## 12. UX rules that should not be broken

1. **Do not mix fair value and trade entry.**
2. **Do not hide uncertainty.** If coverage/freshness/quality is weak, show it.
3. **Do not collapse everything into one unexplained score.**
4. **Do not overfill the card.** Top card should stay concise.
5. **Do not use guarantee language.** Keep the feature educational and decision-supportive.

---

## 13. V1 recommendation

The first production version should focus on:

- one derived decision summary object;
- one top-level summary card in the workspace/symbol analysis area;
- deterministic rules based on existing data;
- valuation label first, fair value later;
- explicit handling of partial data.

That gives the user meaningful guidance quickly, without waiting for a perfect fair-value system.

---

## 14. Final product stance

The cleanest product framing is:

- **Technicals decide timing.**
- **Fundamentals decide conviction.**
- **Valuation decides whether price is attractive or stretched.**
- **Catalysts decide why the symbol matters now.**

The combined summary should make that logic visible in a few seconds, so the user can choose what to do with a symbol without digging through multiple tabs first.
