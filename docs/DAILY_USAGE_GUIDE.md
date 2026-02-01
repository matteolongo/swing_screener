# How to Use Swing Screener (Daily Guide – Barcelona / CET)

This guide explains **how and when to use Swing Screener in real life**  
if you live in **Barcelona (CET / CEST)** and trade **US stocks**.

This is not about code — it’s about **correct behavior**.

---

## ⏰ US Market Hours (from Barcelona)

- US market open: **15:30 – 22:00**
- First 30–60 minutes: noisy
- Last 30 minutes: emotional

Swing trading does **not** require watching the market live.

---

## ✅ Best Time to Run the Screener

👉 **Every weekday between 22:15 and 22:45 (Barcelona time)**

Why:
- The US market is **closed**
- Daily candles are **final**
- Signals are **stable**
- No intraday noise

This is the single most important rule.

---

## 📆 Daily Routine (10 minutes)

### 1️⃣ Run the screener (after market close)

```bash
swing-screener run --tickers AAPL MSFT NVDA AMZN META INTC SPY --positions positions.json --csv out/report.csv
```

`--positions` excludes tickers you already hold from new candidates.
You are preparing **tomorrow’s trades** using **today’s final data**.

---

### 2️⃣ Read the “TODAY ACTIONS” section

Example:

```
INTC: breakout | entry~47.29 | stop~42.88 | shares=1 | risk~4.41
```

Interpretation:
- This is a **trade plan**, not a prediction
- Maximum loss is already defined
- You are risking **4.41 €**, not 47 €

Ask yourself:
> “Am I OK losing this amount tomorrow?”

If yes → proceed  
If no → skip (skipping is allowed)

---

### 3️⃣ Place orders on DEGIRO (same evening)

**Buy order**
- Type: Limit
- Price: entry (or slightly above)
- Quantity: suggested shares
- Duration: Day or GTC

**Stop-loss**
- Type: Stop Market
- Price: stop level
- Quantity: same as buy

Place both orders **before going to sleep**.

---

### 4️⃣ Next day: do nothing

From **15:30 to 22:00**:
- Do not watch charts
- Do not move stops
- Do not add size

Your decision was already made the evening before.

---

## 📊 Weekly Routine (15–20 min)

**Best time:** Saturday morning

- Review executed trades
- Ask:
  - Did I follow the rules?
  - Did I respect the stop?
- Do NOT change parameters emotionally

---

## 📆 Monthly Routine (30 min)

**Best time:** first weekend of the month

- Run backtests
- Review:
  - win rate
  - average R
  - drawdowns
- Change **at most one parameter**, and only if justified
- Backtest model: signals/ATR use completed bars, entries execute next-day open, exits are gap-aware (stop/TP priority) with optional commission.

---

## ❌ What NOT to Do

- Do not run the screener during US hours
- Do not chase intraday moves
- Do not move stops lower
- Do not increase size impulsively
- Do not trade because of news or Twitter

Your system already filters noise.
Do not reintroduce it manually.

---

## 🧠 Correct Mental Model

Think of Swing Screener as:

> “An assistant that prepares **tomorrow’s decisions** using **today’s closed data**.”

Not:
- a trading bot
- a prediction engine
- a signal spammer

---

## ✅ Final Reminder

If there are **no signals today**:
> That is a success, not a failure.

Boring, calm, repeatable behavior is the goal.
