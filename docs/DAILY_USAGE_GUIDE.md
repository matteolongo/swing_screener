# How to Use Swing Screener (Daily Guide – Barcelona / CET)

This guide explains **how and when to use Swing Screener in real life**  
if you live in **Barcelona (CET / CEST)** and trade **US stocks**.

This is not about code — it's about **correct behavior**.

---

## 🌐 Two Ways to Work

### Web UI Workflow (Recommended)

**Best for:** Daily interactive trading, visual review, order creation

**Daily Routine (~10 minutes, 22:15-22:45 CET):**

1. **Open Dashboard** at http://localhost:5173
2. **Review** portfolio summary, P&L, action items
3. **Run Screener:** Select universe → Click "Run Screener"
4. **Create Orders:** Click "Create Order" for candidates you want
5. **Review Risk:** Check position value and max loss in modal
6. **Submit Orders:** They appear as PENDING in Orders page
7. **Next Morning:** Execute at broker, then "Fill Order" in UI
8. **Manage Positions:** Update stops for positions at +1.5R or +2R

👉 **See [WEB_UI_GUIDE.md](WEB_UI_GUIDE.md) for detailed Web UI documentation**

---

### CLI Workflow (Advanced)

**Best for:** Automation, scripting, headless environments

---

## 🌐 Two Ways to Work

### Web UI Workflow (Recommended)

**Best for:** Daily interactive trading, visual review, order creation

**Daily Routine (~10 minutes, 22:15-22:45 CET):**

1. **Start the servers** (if not already running)
   ```bash
   # Terminal 1: Backend
   python -m uvicorn api.main:app --port 8000 --reload
   
   # Terminal 2: Frontend
   cd web-ui && npm run dev
   ```

2. **Open http://localhost:5173**

3. **Dashboard:** Review portfolio summary, P&L, action items

4. **Screener Page:**
   - Select universe (e.g., "mega")
   - Click "Run Screener"
   - Review candidates table
   - Click "Create Order" for stocks you want to trade
   - Review risk metrics in modal
   - Submit orders

5. **Orders Page:**
   - Review pending orders
   - Tomorrow morning: execute at broker (Degiro)
   - After execution: click "Fill Order"
   - Enter fill price and date

6. **Positions Page:**
   - Review open positions
   - Update stops for positions at +1.5R or +2R
   - Close positions that hit targets

👉 **See [WEB_UI_GUIDE.md](WEB_UI_GUIDE.md) for detailed Web UI documentation**

---

### CLI Workflow (Advanced)

**Best for:** Automation, scripting, headless environments

**Daily Routine (~10 minutes, 22:15-22:45 CET):**


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
swing-screener run --tickers AAPL MSFT NVDA AMZN META INTC SPY --positions data/positions.json --csv out/report.csv
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
- Backtest model: signals/ATR use completed bars, entries execute next-day open, exits are gap-aware. Exit mode can be take-profit or trailing stop (breakeven + SMA). Optional commission.

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
