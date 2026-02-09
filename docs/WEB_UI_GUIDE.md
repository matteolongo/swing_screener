# Swing Screener Web UI - User Guide

Complete guide to using the Swing Screener web interface for daily swing trading operations.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Daily Workflow](#daily-workflow)
- [Pages Overview](#pages-overview)
- [Features in Detail](#features-in-detail)
- [Tips & Best Practices](#tips--best-practices)
- [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Backend installed (`pip install -e .`)
- Frontend dependencies installed (`cd web-ui && npm install`)

### Starting the Application

You need **two terminal windows**:

#### Terminal 1: Backend API

```bash
cd /path/to/swing_screener
python -m uvicorn api.main:app --port 8000 --reload
```

**Expected output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
```

#### Terminal 2: Frontend

```bash
cd /path/to/swing_screener/web-ui
npm run dev
```

**Expected output:**
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### Access the Application

Open your browser to **http://localhost:5173**

You should see the Dashboard page with your portfolio summary.

---

## Daily Workflow

This is the recommended daily routine (after market close, ~22:00 CET):

### 1. **Check Dashboard** 📊

- Review portfolio summary (open positions, P&L)
- Check action items (stops to update, orders to fill)
- Quick glance at daily performance

### 2. **Run Screener** 🔍

Navigate to **Screener** page:

1. Select universe (e.g., "mega_all", "defense_all", "amsterdam_aex", "amsterdam_all")
2. Optionally set "Top N" limit (e.g., 10)
3. Click **"Run Screener"**
4. Wait for results (~10-30 seconds depending on universe size)

### 3. **Review Candidates** 📋

The results table shows:
- **Ticker** - Stock symbol
- **Signal** - Entry signal type (BREAKOUT, PULLBACK)
- **Close Price** - Latest closing price
- **Entry Price** - Suggested entry (limit or stop order)
- **Stop Price** - Suggested stop loss (entry - 2×ATR)
- **ATR** - Average True Range (volatility measure)
- **Trend/Momentum** - Technical indicators
- **Shares** - Calculated position size based on risk config
- **Social Overlay** - Risk-only status (OK/Reduced/Review/Veto) with reason codes

### 4. **Create Orders** ✅

For candidates you want to trade:

1. Click **"Create Order"** button in the candidate row
2. **Review pre-filled values** in the modal:
   - Entry price (can adjust)
   - Stop price (can adjust, but must respect risk)
   - Quantity (pre-calculated based on account size × risk%)
3. **Verify risk metrics**:
   - Position value (should be ≤ max position %)
   - R = entry - stop (your risk per share)
   - Max loss = shares × R (should be ≤ account × risk%)
4. Click **"Create Order"**

The order will appear in the **Orders** page as "PENDING".

### 5. **Manage Positions** 📈

Navigate to **Positions** page:

- **View all positions** (open and closed)
- **Filter** by status (open/closed)
- **Update stops** (upward only, for risk protection)
- **Close positions** manually
- **Review P&L** (real-time with color coding)

### 6. **Execute Orders at Broker** 🏦

Go to **Orders** page:

1. Click on a PENDING order to see details
2. **Manually place the order at your broker** (e.g., Degiro):
   - For LIMIT orders: place limit buy at entry price
   - For STOP orders: place stop buy at entry price
   - For SELL_STOP: place stop-loss at stop price
3. **After execution at broker**, click **"Fill Order"** in the UI
4. Enter fill price and date
5. Order status changes to FILLED
6. If it was an entry order, a **Position is automatically created**

---

## Pages Overview

### 🏠 Dashboard

**Purpose:** Portfolio overview and daily snapshot

**What you see:**
- **Portfolio Summary Card**
  - Total account size
  - Open positions count
  - Position value (sum of all open positions)
  - Total P&L (color-coded: green = profit, red = loss)
- **Action Items**
  - Pending orders to execute
  - Positions approaching stops
  - Suggested stop updates
- **Quick Actions**
  - Navigate to Screener
  - Navigate to Orders
  - Navigate to Positions

**When to use:** Every session start, quick health check

---

### 🔍 Screener

**Purpose:** Find new trade candidates

**What you can do:**
- Select a stock universe
- Set Top N limit (optional)
- Run screener with current config
- View candidates sorted by strength
- Create orders directly from results

**Key features:**
- **Create Order Modal**
  - Pre-fills entry/stop/quantity from screener
  - Auto-calculates risk metrics
  - Validates against account size and risk limits
  - Shows position value and max loss
- **Candidate table columns**
  - Signal type (BREAKOUT/PULLBACK)
  - Technical indicators (SMA, momentum, relative strength)
  - Pre-calculated position sizing

**When to use:** Daily, after market close (~22:00 CET for US stocks)

---

### 📈 Backtest

**Purpose:** Run full backtests using your current settings and review saved simulations

**What you can do:**
- Enter tickers and date range
- Choose entry mode (Auto / Breakout / Pullback)
- Tune backtest parameters (ATR, trailing rules, lookbacks)
- Run and automatically save simulations
- Load or delete past simulations

**Key features:**
- **Equity curve chart** with per‑ticker lines (toggle visibility)
- **Summary stats** and per‑ticker breakdowns
- **Trades table** with exit reasons and R‑multiples

**When to use:** Strategy evaluation, parameter tuning, or post‑market review

---

### 🧭 Strategy

**Purpose:** Edit strategy definitions and switch the active strategy

**What you can do:**
- Select a strategy to edit
- Update minimal settings (signals, risk, filters)
- Expand **Advanced Settings** for full control
- Save a new strategy variant ("Save as New")
- Use indicator hints next to each indicator setting
- Set the active strategy used across the app
- Configure the **Social Overlay** (risk-only safeguards using social signals)
  - Includes **Lookback Hours** to control how far back social data is scanned

**When to use:** When changing strategy parameters or comparing variants

---

### 📋 Orders

**Purpose:** Manage all orders (pending, filled, cancelled)

**What you can do:**
- **View all orders** with filtering
  - Filter by status: ALL, PENDING, FILLED, CANCELLED
  - Filter by side: ALL, BUY, SELL, SELL_STOP
- **Create new orders** manually
- **Fill orders** after execution at broker
- **Cancel orders** if you change your mind
- **Delete orders** (removes from history)

**Order Types:**
- **LIMIT** - Buy at or below entry price
- **STOP** - Buy when price breaks above entry (breakout)
- **SELL_STOP** - Stop-loss order (protective)

**When to use:**
- After running screener (create orders)
- After executing at broker (fill orders)
- Daily review of pending orders

---

### 📈 Positions

**Purpose:** Track and manage open/closed positions

**What you can do:**
- **View all positions** with filtering
  - Open positions (currently held)
  - Closed positions (historical)
- **Update stops** on open positions
  - **Important:** Stops can only move UP (risk protection)
  - Useful for trailing stops as price moves in your favor
- **Close positions** manually
  - Enter exit price and date
  - System calculates final P&L
- **View detailed metrics**
  - Entry price, current price, exit price
  - P&L (absolute $ and %)
  - R-multiples (e.g., +2.5R = profit of 2.5× initial risk)
  - Position size and value

**Key Features:**
- **P&L Color Coding**
  - 🟢 Green = Profitable position
  - 🔴 Red = Losing position
  - ⚪ Gray = Breakeven
- **R-Multiple Tracking**
  - Shows how many "R" units you've made/lost
  - 1R = your initial risk (entry - stop)
  - Example: Entered at $100, stop at $98 (R=$2)
    - Current price $105 = +2.5R profit

**When to use:**
- Daily review of portfolio
- When stock hits target or stop
- For trailing stop updates

---

### ⚙️ Settings

**Purpose:** Configure trading system parameters

**Three main sections:**

#### 1. Account & Risk Management
Account sizing and risk settings are now managed per‑strategy.

Use the **Strategy** page to edit:
- Account Size
- Risk per Trade
- Max Position Size
- ATR Multiplier

#### 2. Technical Indicators
- **SMA Fast** - Short-term moving average (20 days default)
- **SMA Mid** - Medium-term moving average (50 days default)
- **SMA Long** - Long-term moving average (200 days default)
- **ATR Period** - Average True Range lookback (14 days default)

#### 3. Position Management
- **Breakeven at R** - Move stop to breakeven after +NR profit (1.5R default)
- **Trail After R** - Start trailing stop after +NR profit (2.0R default)
- **Trail Distance (ATR)** - Trail stop at price - N×ATR (1.5× default)

**When to use:**
- Initial setup
- When changing strategy parameters
- Adjusting risk based on market conditions

**Important Notes:**
- Settings are saved in **localStorage** (browser)
- **Reset to Defaults** button restores factory settings
- Backend also has a config file (`data/positions.json` location)

---

## Features in Detail

### Create Order Modal

**Triggered from:** Screener results (click "Create Order" on a candidate)

**Pre-filled fields:**
- Ticker (from candidate)
- Entry Price (from screener signal)
- Stop Price (entry - 2×ATR)
- Quantity (calculated from risk config)
- Order Type (LIMIT or STOP based on signal)

**Editable fields:**
- Entry Price (you can adjust)
- Stop Price (you can adjust)
- Quantity (you can adjust, but risk validation applies)
- Order Type (switch between LIMIT/STOP if needed)

**Risk Validation:**
- Shows Position Value = entry × quantity
- Shows Max Loss = (entry - stop) × quantity
- **Prevents order creation if:**
  - Position value > account × max position %
  - Max loss > account × risk %
  - Stop price ≥ entry price (invalid risk)

**What happens after creation:**
- Order appears in Orders page as PENDING
- You manually execute at your broker
- Return to UI and click "Fill Order"
- If it's a BUY order and filled → Position auto-created

---

### P&L Calculations

**For Open Positions:**
```
P&L = (current_price - entry_price) × shares
P&L % = (current_price - entry_price) / entry_price × 100
```

**For Closed Positions:**
```
P&L = (exit_price - entry_price) × shares
P&L % = (exit_price - entry_price) / entry_price × 100
```

**Current Price Source:**
- Fetched from backend (latest market data)
- Falls back to entry price if current data unavailable

---

### R-Multiple Tracking

**What is R?**
R = Initial Risk = Entry Price - Stop Price

**Example:**
- Entry: $100
- Stop: $98
- R = $2

**Interpreting R-Multiples:**
- **+1R**: Profit equals initial risk ($2 profit)
- **+2R**: Profit is 2× initial risk ($4 profit)
- **-1R**: Loss equals initial risk (stop hit)
- **-0.5R**: Partial loss (sold before stop)

**How it's calculated:**
```
R_now = (current_price - entry_price) / (entry_price - stop_price)
```

**Why it matters:**
- Normalizes performance across different position sizes
- Easier to track system performance
- Goal: Average R > 1.5R per winning trade

---

### Stop Update Rules

**Critical rule:** Stops can **only move UP**, never down.

**Why?**
- Risk protection
- Prevents you from "giving back" gains
- Enforces disciplined trailing

**How to update:**
1. Go to Positions page
2. Find open position
3. Click "Update Stop"
4. Enter new stop price
5. **Validation:** New stop > old stop
6. If valid, stop is updated

**Best practice:**
- Update stops when position reaches +1.5R or +2R
- Use trailing formula: `new_stop = current_price - (1.5 × ATR)`
- Never move stop closer to current price during drawdowns

---

## Tips & Best Practices

### 🕐 Timing

**Best time to run screener:**
- **After market close** (~22:00 CET for US stocks)
- Daily candles are final, signals are stable
- No intraday noise

**Avoid:**
- Running screener during market hours (incomplete candles)
- Making decisions in first/last 30 minutes of trading day

---

### 🎯 Order Execution

1. **Create orders in UI** after running screener
2. **Review risk metrics** before submitting
3. **Wait for next trading day** to execute
4. **Place orders at broker** manually (Degiro, IBKR, etc.)
5. **Return to UI** and mark order as filled
6. **Repeat daily**

**Why manual execution?**
- Broker APIs are complex and fragile
- Manual gives you final control
- Degiro doesn't have reliable API

---

### 📊 Position Management

**Daily checklist:**
- [ ] Check Dashboard for action items
- [ ] Review open positions P&L
- [ ] Update stops for positions at +1.5R or +2R
- [ ] Close positions that hit targets or stops at broker
- [ ] Mark closed positions in UI

**When to close:**
- Stop loss hit
- Target reached (optional, can trail instead)
- Signal reversal (e.g., broke below SMA 200)
- Risk management (too many correlated positions)

---

### ⚙️ Configuration

**Conservative defaults (recommended):**
- Account: $50,000
- Risk: 1% ($500 per trade)
- Max Position: 60% ($30,000)

**Aggressive (experienced traders):**
- Risk: 2-3%
- Max Position: 100%

**Risk management:**
- Never risk more than 2% per trade
- Keep max position ≤ 60% (diversification)
- Adjust based on win rate and R-multiples

---

## Troubleshooting

### Backend not starting

**Error:** `Address already in use`

**Fix:** Port 8000 is occupied. Kill the process:
```bash
lsof -ti:8000 | xargs kill -9
python -m uvicorn api.main:app --port 8000 --reload
```

---

### Frontend not connecting to API

**Symptoms:** API calls fail, "Network Error" in console

**Fix:**
1. Verify backend is running: `curl http://localhost:8000/health`
2. Check CORS settings in `api/main.py` (should allow localhost:5173)
3. Restart both servers

---

### Screener returns no results

**Possible causes:**
1. **All stocks filtered out** (already in positions)
2. **No stocks meet trend criteria** (market conditions)
3. **Data fetch failed** (yfinance throttling)

**Fix:**
1. Try different universe
2. Check console for errors
3. Verify `data/positions.json` is valid JSON

---

### Orders not creating positions when filled

**Cause:** Order type mismatch

**Fix:**
- Only **BUY** (LIMIT/STOP) orders create positions
- **SELL_STOP** orders link to existing positions
- Verify order type before filling

---

### Settings not persisting

**Cause:** localStorage cleared or different browser

**Fix:**
- Settings are browser-specific
- Use same browser for consistency
- Export positions/orders regularly (manual JSON backup)

---

### P&L showing $0.00

**Cause:** Missing `current_price` in position data

**Fix:**
- Backend should fetch live prices
- Check API response: `curl http://localhost:8000/api/positions`
- Restart backend to refresh market data cache

---

## Additional Resources

- **API Reference:** See `api/README.md` for endpoint documentation
- **Architecture:** See `web-ui/README.md` for React component structure
- **CLI Alternative:** See `docs/OPERATIONAL_GUIDE.md` for CLI workflows
- **Daily Routine:** See `docs/DAILY_USAGE_GUIDE.md` for Barcelona/CET timing

---

## Support

For issues or feature requests:
1. Check existing documentation
2. Review `ROADMAP.md` for planned features
3. Check `AGENTS.md` if working with AI assistants

---

**Last Updated:** February 8, 2026
