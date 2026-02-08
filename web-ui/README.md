# Swing Screener Web UI

Modern React + TypeScript web interface for the Swing Screener trading system.

## Features Implemented

✅ **Foundations**
- React 18 + TypeScript + Vite
- Tailwind CSS styling
- React Router navigation
- Zustand state management
- Educational help system (HelpTooltip component)

✅ **Settings Module**
- Account & Risk Management configuration
- Technical Indicators settings
- Position Management rules
- Comprehensive educational tooltips with formulas and examples
- Local storage persistence

✅ **Dashboard**
- Portfolio summary
- Action items
- Quick actions
- Getting started guide

## Project Structure

```
web-ui/
├── src/
│   ├── components/
│   │   ├── layout/          # Header, Sidebar, MainLayout
│   │   ├── common/          # Button, Card, HelpTooltip
│   │   └── domain/
│   │       └── settings/    # Settings form components
│   ├── pages/               # Dashboard, Settings
│   ├── stores/              # Zustand stores (config, positions)
│   ├── types/               # TypeScript type definitions
│   └── utils/               # Formatters, utilities
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## Getting Started

### 1. Install Dependencies

```bash
cd web-ui
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 3. Start Backend API (in separate terminal)

```bash
cd ..
python -m uvicorn api.main:app --reload --port 8000
```

## Educational System

The app includes a comprehensive educational system for beginners:

- **Hover tooltips**: Quick one-line explanations
- **Click modals**: Detailed explanations with:
  - Formulas (with code blocks)
  - Real examples with numbers
  - Visual explanations
  - Warnings and best practices
  - "Why it matters" sections

Every configuration field has educational content explaining:
- What it is
- How it's calculated
- Why it matters
- Recommended values
- Common pitfalls

## Configuration

All settings are persisted to browser localStorage and include:

### Risk Management
- Account Size
- Risk Per Trade (%)
- Max Position Size (%)
- ATR Multiplier (k)

### Indicators
- SMA Windows (20/50/200)
- ATR Window (14)
- Momentum Lookback (126/252 days)
- Benchmark (SPY)

### Position Management
- Breakeven at 1R
- Trail after 2R
- Trail below SMA20
- SMA Buffer (0.5%)
- Max Holding Days (20)

## Next Steps

Remaining modules to implement:
- [ ] Screener (find opportunities)
- [ ] Orders (create, track, fill)
- [ ] Positions (manage open trades)
- [ ] Backend API (FastAPI)
- [ ] Charts integration (optional)

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool (fast HMR)
- **Tailwind CSS** - Styling
- **Zustand** - State management (lightweight)
- **React Router** - Navigation
- **Lucide React** - Icons
- **TanStack Query** - Data fetching (React Query)

## Development Commands

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```
