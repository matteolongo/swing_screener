# Swing Screener - Implementation Roadmap

**Current Status:** ✅ Production-Ready (Core + Web UI + Testing Complete)  
**Last Updated:** February 11, 2026

---

## 🚧 In Progress

### Daily Routine Restoration (v2/daily-routine-revamp)
Restoring the daily workflow for position management and trade candidate review.

**Status:** Phase 2 complete, Phase 3 in progress

- ✅ **Phase 1 (Backend):** Stop order synchronization
  - Cancel old SELL_STOP orders when position stop updated
  - Create new order with updated price
  - Link via `exit_order_ids` for audit trail
  - 4/4 tests passing

- ✅ **Phase 1 (Frontend):** Modal pre-fill with suggested stop
  - Auto-populate UpdateStopModal with suggested stop price
  - Invalidate orders query on update
  - User doesn't need manual "Use Suggested" click

- ✅ **Phase 2 (Backend):** Daily Review API endpoint
  - GET `/api/daily-review` endpoint with `top_n` parameter
  - Returns categorized positions and trade candidates
  - Service combines screener + position analysis
  - 8/8 tests passing

- ⏳ **Phase 3 (Frontend):** Daily Review page
  - New dedicated page with 4 sections
  - Collapsible sections for clean UX
  - Quick action buttons (Update All Stops)
  - Add to navigation sidebar

- ⏳ **Phase 4:** CLI integration
- ⏳ **Phase 5:** Testing & documentation

**Branch:** v2/daily-routine-revamp  
**ETA:** Phase 3 next

---

## 📋 Planned

### LLM-Augmented Market Intelligence (Proposal)
Enhance the existing intelligence layer with optional LLM capabilities for semantic event classification and educational explanations.

**Features:**
- Event classification (EARNINGS, M&A, PRODUCT, etc.)
- Headline deduplication to reduce noise
- Beginner-friendly explanations for top opportunities
- Strict guardrails: LLMs interpret, never decide

**Status:** Proposal stage (see `docs/issues/llm_market_intelligence_adapted.md`)  
**Priority:** Medium (optional enhancement)  
**Timeline:** 2-3 weeks if approved  
**Cost:** ~$0.30/month  

**Documentation:**
- Short issue: `docs/issues/llm_market_intelligence_adapted.md`
- Full implementation guide: `docs/LLM_INTELLIGENCE_IMPLEMENTATION.md`

---

### Currency Filtering
Allow filtering screener results by currency (USD/EUR) and display currency in all tables.

**Features:**
- Filter dropdown: All / USD only / EUR only
- Currency detection from ticker suffix (.AS = EUR, default = USD)
- Show currency symbol in all tables
- Persist filter choice in config

**Status:** Queued after daily routine completion  
**Priority:** Medium

---

## ✅ What's Complete

### Core Trading System (100%)
- [x] FastAPI backend with 18 REST endpoints
- [x] Config management (GET/PUT/reset/defaults)
- [x] Screener execution with market data
- [x] Positions CRUD (view/update stop/close)
- [x] Orders CRUD (create/fill/cancel)
- [x] NaN handling for JSON files
- [x] Error handling and validation

### MCP Server (100%)
- [x] Model Context Protocol integration (stdio transport)
- [x] 22 tools across 6 feature domains
- [x] Portfolio tools (9) - complete position/order management
- [x] Screener tools (3) - stock screening and analysis
- [x] Strategy tools (4) - strategy management
- [x] Config tools (2) - application configuration
- [x] Daily Review tools (2) - comprehensive workflow
- [x] Social tools (2) - sentiment analysis
- [x] Modular architecture (one file per tool)
- [x] YAML-based configuration with feature toggles
- [x] Zero service layer changes (reuses existing services)

### Web UI (100%)
- [x] React + TypeScript + Vite frontend
- [x] Dashboard with real data (portfolio summary, P&L, action items)
- [x] Screener with Create Order modal and risk validation
- [x] Orders page (full CRUD with filtering)
- [x] Positions page (full CRUD with P&L calculations)
- [x] Settings page with localStorage persistence
- [x] Dark mode support
- [x] Responsive design
- [x] Educational help system

### Testing Infrastructure (100%)
- [x] Vitest + React Testing Library + MSW setup
- [x] 51 unit tests (types, utils, API client)
- [x] 24 component tests (Button, Card, Badge)
- [x] 87 integration tests (all 5 pages)
- [x] 80%+ code coverage
- [x] Comprehensive test documentation

**Total:** 158 passing tests, ~1.66s execution time

### Documentation (100%)
- [x] Web UI user guide (`docs/WEB_UI_GUIDE.md`)
- [x] API reference (`api/README.md`)
- [x] CLI operational guide (`docs/OPERATIONAL_GUIDE.md`)
- [x] Daily usage guide (`docs/DAILY_USAGE_GUIDE.md`)
- [x] Updated README with Web UI quick start
- [x] AGENTS.md with Web UI architecture

---

## 🚀 What's Production-Ready

The system is **ready for daily manual trading** with:
- ✅ Complete Web UI workflow (screener → orders → positions)
- ✅ Risk-first validation (position sizing, stop validation)
- ✅ R-multiple tracking and P&L calculations
- ✅ Comprehensive test coverage
- ✅ Full documentation

**You can start trading with this system today.**

---

## 🔮 Future Vision

### Education-First Refactor
Large-scale UX improvements for teaching risk-first trading principles.

**Scope:** See `docs/EDUCATION_REFACTOR_PLAN.md` for full details
- Recommendation Engine with BUY/AVOID/PASS verdicts
- Risk gates and checklist validation
- Structured reasons and warnings
- Progressive disclosure UI pattern
- Realistic backtesting with fees/slippage

**Status:** Vision document, not prioritized  
**Note:** May conflict with "simplicity over cleverness" philosophy

---

## 🚧 Missing for Production-Ready Application

### 1. Authentication & Security (HIGH PRIORITY)

#### Backend
- [ ] User authentication (JWT tokens)
- [ ] Password hashing (bcrypt)
- [ ] Protected API endpoints
- [ ] API rate limiting
- [ ] HTTPS/SSL certificates
- [ ] Secure session management

#### Frontend
- [ ] Login page
- [ ] Registration page
- [ ] Password reset flow
- [ ] Session timeout handling
- [ ] Protected routes (require auth)

**Why:** Prevent unauthorized access to trading data

---

### 2. Data Persistence (HIGH PRIORITY)

#### Database Migration
- [ ] Replace JSON files with database (PostgreSQL/SQLite)
- [ ] Database schema design
- [ ] Migration scripts for existing data
- [ ] Database backup/restore procedures
- [ ] Transaction support for atomic operations

#### Data Models
- [ ] Users table
- [ ] Positions table (with history)
- [ ] Orders table (with audit log)
- [ ] Config table (per-user configs)
- [ ] Market data caching

**Why:** JSON files don't scale, lack ACID guarantees, prone to corruption

---

### 3. Real-Time Price Updates (MEDIUM PRIORITY)

#### Backend
- [ ] WebSocket server for live price feeds
- [ ] Market data subscription service
- [ ] Price update broadcasting
- [ ] Automatic stop-loss monitoring
- [ ] Alert system for price triggers

#### Frontend
- [ ] WebSocket client connection
- [ ] Real-time position P&L updates
- [ ] Live price tickers in tables
- [ ] Notification system (toast/banner)

**Why:** Manual price refresh isn't practical for active trading

---

### 4. Broker Integration (MEDIUM PRIORITY)

#### Order Execution
- [ ] Degiro API integration (or your broker)
- [ ] Auto-submit orders to broker
- [ ] Sync filled orders from broker
- [ ] Account balance synchronization
- [ ] Trade execution confirmation

#### Position Management
- [ ] Auto-sync positions from broker
- [ ] Real-time portfolio valuation
- [ ] Dividend tracking
- [ ] Corporate actions handling

**Why:** Eliminate manual order entry at broker

---

### 5. Advanced Analytics (LOW PRIORITY)

#### Performance Metrics
- [ ] Win rate calculations
- [ ] Average R-multiple per trade
- [ ] Sharpe/Sortino ratios
- [ ] Maximum drawdown tracking
- [ ] Monthly/yearly performance reports

#### Visualizations
- [ ] Equity curve chart
- [ ] Position P&L over time
- [ ] Risk exposure chart
- [ ] Sector allocation pie chart
- [ ] Correlation heatmap

**Why:** Measure and improve system performance

---

### 6. Backtesting Enhancements (LOW PRIORITY)

#### Features
- [ ] Run backtest from UI
- [ ] Parameter optimization
- [ ] Walk-forward analysis
- [ ] Monte Carlo simulation
- [ ] Compare multiple strategies

#### Reporting
- [ ] Backtest results visualization
- [ ] Trade log export (CSV/Excel)
- [ ] Performance comparison charts

**Why:** Validate strategies before live trading

---

### 7. Notifications & Alerts (MEDIUM PRIORITY)

#### Alert Types
- [ ] Email notifications (order filled, stop hit)
- [ ] SMS alerts for critical events
- [ ] Browser push notifications
- [ ] Discord/Telegram bot integration
- [ ] Custom alert rules

#### Triggers
- [ ] Position P&L threshold
- [ ] Stop price approaching
- [ ] New screener candidates
- [ ] Order fill confirmations

**Why:** Stay informed without constant monitoring

---

### 8. Mobile Support (LOW PRIORITY)

#### Responsive Enhancements
- [ ] Mobile-optimized layout
- [ ] Touch-friendly controls
- [ ] Swipe gestures for tables
- [ ] Mobile navigation menu

#### Native App (Optional)
- [ ] React Native mobile app
- [ ] iOS/Android support
- [ ] Push notification permissions

**Why:** Monitor positions on the go

---

### 9. Data Management (MEDIUM PRIORITY)

#### Backup & Recovery
- [ ] Automated daily backups
- [ ] Point-in-time recovery
- [ ] Export all data (JSON/CSV)
- [ ] Import historical trades

#### Data Retention
- [ ] Archive closed positions
- [ ] Trade history pagination
- [ ] Performance data retention policy

**Why:** Prevent data loss, manage long-term storage

---

### 10. Error Handling & Logging (HIGH PRIORITY)

#### Backend
- [ ] Centralized error logging (Sentry/LogRocket)
- [ ] Request/response logging
- [ ] Performance monitoring (New Relic/Datadog)
- [ ] Error alerting system

#### Frontend
- [ ] Global error boundary
- [ ] User-friendly error messages
- [ ] Retry mechanisms for failed API calls
- [ ] Offline mode detection

**Why:** Debug production issues, improve reliability

---

### 11. Testing & Quality (MEDIUM PRIORITY)

#### Backend Tests
- [ ] Unit tests (pytest) - 80%+ coverage
- [ ] Integration tests for endpoints
- [ ] Load testing (simulate high traffic)
- [ ] Security testing (penetration tests)

#### Frontend Tests
- [ ] Component unit tests (Jest/Vitest)
- [ ] E2E tests (Playwright/Cypress)
- [ ] Visual regression tests
- [ ] Accessibility tests (a11y)

#### CI/CD
- [ ] GitHub Actions pipeline
- [ ] Automated testing on PR
- [ ] Automated deployment
- [ ] Staging environment

**Why:** Prevent regressions, ensure quality

---

### 12. Documentation (MEDIUM PRIORITY)

#### User Documentation
- [ ] User manual (how to use each feature)
- [ ] Trading strategy guide
- [ ] Risk management tutorial
- [ ] FAQ section
- [ ] Video tutorials

#### Developer Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Architecture diagrams
- [ ] Database schema documentation
- [ ] Setup/deployment guide
- [ ] Contributing guidelines

**Why:** Onboard users, help contributors

---

### 13. Configuration Management (LOW PRIORITY)

#### Environment-Specific
- [ ] Development/staging/production configs
- [ ] Environment variables (.env files)
- [ ] Secrets management (Vault/AWS Secrets)
- [ ] Feature flags for gradual rollout

**Why:** Separate dev/prod environments safely

---

### 14. Performance Optimization (LOW PRIORITY)

#### Backend
- [ ] Database indexing
- [ ] Query optimization
- [ ] Caching layer (Redis)
- [ ] API response compression
- [ ] Connection pooling

#### Frontend
- [ ] Code splitting (lazy loading)
- [ ] Image optimization
- [ ] Service worker (PWA)
- [ ] CDN for static assets

**Why:** Improve user experience, reduce costs

---

### 15. Compliance & Legal (HIGH PRIORITY if public)

#### Financial Regulations
- [ ] Terms of service
- [ ] Privacy policy
- [ ] Data protection (GDPR compliance)
- [ ] Disclaimer (not financial advice)
- [ ] User data export/deletion

**Why:** Legal protection, regulatory compliance

---

## 📊 Priority Summary

### Must Have (Production)
1. Authentication & Security
2. Database persistence
3. Error logging & monitoring
4. Testing (basic coverage)

### Should Have (V2)
1. Real-time price updates
2. Notifications & alerts
3. Broker integration
4. Data backup/recovery

### Nice to Have (V3)
1. Advanced analytics
2. Mobile support
3. Backtesting UI
4. Performance optimization

---

## 🎯 Recommended Implementation Order

### Phase 1: Production Hardening (2-3 weeks)
1. Authentication system
2. PostgreSQL database migration
3. Error logging (Sentry)
4. Basic unit tests
5. Deployment automation

### Phase 2: Enhanced Features (3-4 weeks)
1. Real-time price updates (WebSocket)
2. Email/SMS notifications
3. Data backup automation
4. Performance monitoring

### Phase 3: Broker Integration (4-6 weeks)
1. Degiro API integration
2. Auto-sync positions/orders
3. Order execution flow
4. Reconciliation system

### Phase 4: Analytics & Mobile (3-4 weeks)
1. Performance dashboards
2. Advanced charts
3. Mobile-responsive improvements
4. Export/reporting features

---

## 💰 Estimated Effort

**Total Hours:** ~500-600 hours  
**Timeline:** 3-4 months (1 developer)

**Breakdown:**
- Authentication: 40 hours
- Database migration: 60 hours
- Real-time features: 80 hours
- Broker integration: 120 hours
- Analytics: 60 hours
- Testing: 100 hours
- Documentation: 40 hours

---

## 🚀 Current State

**You have:** A fully functional manual trading system  
**You need:** Production hardening + automation

**Decision Point:** 
- Keep it manual → Deploy current version (add auth + DB)
- Full automation → Implement all phases

---

_This roadmap represents features for a commercial-grade trading platform. The current system is production-ready for manual trading._
