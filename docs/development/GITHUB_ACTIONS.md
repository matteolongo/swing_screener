# CI/CD Workflow Improvements Summary

## Changes Made to `.github/workflows/tests.yml`

### Before ❌
```yaml
- Run on ALL branches (expensive)
- Just runs `pytest` (no coverage, no reporting)
- Exit code not explicitly checked
- No test failure visibility in GitHub UI
```

### After ✅
```yaml
- Runs only on main + refactor/** branches and PRs to main
- Adds coverage reporting (--cov)
- Adds test result publishing (test-reporter)
- Adds CodeCov integration (optional)
- Explicit failure detection with fail-on-error: true
```

---

## New Features

### 1. **Coverage Tracking**
```yaml
pytest --cov=swing_screener --cov=api --cov-report=xml
```
- Tracks code coverage for `src/swing_screener/` and `api/`
- Generates XML report for CodeCov
- Shows terminal output during test run

### 2. **Test Result Publishing**
```yaml
uses: dorny/test-reporter@v1
```
- Creates beautiful test reports in GitHub UI
- Shows which tests failed with details
- Accessible from Actions tab and PR status checks

### 3. **CodeCov Integration** (Optional)
```yaml
uses: codecov/codecov-action@v4
```
- Uploads coverage to codecov.io
- Shows coverage trends over time
- **Requires:** `CODECOV_TOKEN` secret (or skip this step)

### 4. **Smarter Triggers**
```yaml
on:
  push:
    branches: ["main", "refactor/**"]
  pull_request:
    branches: ["main"]
```
- Only runs on important branches
- Saves GitHub Actions minutes
- Reduces noise

---

## Required Status Checks

To **block merges** when tests fail:

### GitHub Settings Path:
`Repository Settings → Branches → Add Rule`

**For `main` branch:**
1. ✅ Require status checks to pass before merging
2. ✅ Require branches to be up to date before merging  
3. ✅ Add required check: **`pytest`**
4. ✅ Save

Now:
- ❌ Cannot merge PR if `pytest` job fails
- ✅ Green checkmark required on PR
- ⚠️ Stale branches must be updated before merge

---

## What Gets Tested

**Current test suite (after cleanup):**
- 13 test files
- 74 tests
- Tests cover:
  - Screeners & ranking
  - Indicators (trend, momentum, volatility)
  - Backtesting simulator
  - Portfolio management
  - Position sizing & risk
  - CLI workflows
  - Order management

**Not tested (yet):**
- Web UI (React/TypeScript)
- API endpoints (manual via test_api.sh)

---

## How to Verify It Works

### Test the workflow locally:
```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests exactly as CI does
pytest --verbose --tb=short --cov=swing_screener --cov=api --cov-report=term
```

### Test branch protection:
1. Create a PR to `main`
2. Push a commit that breaks tests
3. GitHub should show ❌ and block merge
4. Fix tests and push
5. GitHub should show ✅ and allow merge

---

## Optional: Setup CodeCov

### If you want coverage tracking:

1. **Sign up at codecov.io** (free for open source)
2. **Add repository** to CodeCov
3. **Get token** from CodeCov settings
4. **Add secret** to GitHub:
   - Go to: Repository Settings → Secrets and variables → Actions
   - Click: New repository secret
   - Name: `CODECOV_TOKEN`
   - Value: (paste token from CodeCov)

### If you don't want CodeCov:
- Workflow will still work
- Just won't upload to codecov.io
- Set `fail_ci_if_error: false` (already done)

---

## Future Enhancements

### Add Coverage Threshold
```yaml
pytest --cov-fail-under=80  # Fail if coverage < 80%
```

### Add Linting
```yaml
- name: Lint
  run: ruff check src/ api/ tests/
```

### Add Type Checking
```yaml
- name: Type check
  run: mypy src/ api/
```

### Add Frontend Tests
```yaml
frontend-tests:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/setup-node@v4
    - run: npm ci
    - run: npm test
    working-directory: ./web-ui
```

---

## Summary

**Before:** Tests run but don't block merges  
**After:** Tests must pass to merge ✅

**Branch protection is NOT automatic** - you must configure it in GitHub repository settings (see `.github/BRANCH_PROTECTION.md` for step-by-step guide).
