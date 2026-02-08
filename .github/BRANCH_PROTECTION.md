# Branch Protection Setup

This document explains how to configure branch protection rules to **require passing tests** before merging to `main`.

## GitHub Repository Settings

### Step 1: Enable Branch Protection

1. Go to your repository on GitHub
2. Click **Settings** → **Branches**
3. Click **Add rule** under "Branch protection rules"

### Step 2: Configure Protection for `main`

**Branch name pattern:** `main`

**Require a pull request before merging:**
- ✅ Require a pull request before merging
- ✅ Require approvals: **1** (optional if you're solo)
- ✅ Dismiss stale pull request approvals when new commits are pushed

**Require status checks to pass before merging:**
- ✅ Require status checks to pass before merging
- ✅ Require branches to be up to date before merging
- **Add required status checks:**
  - `pytest` (from our tests.yml workflow)

**Require conversation resolution before merging:**
- ✅ Require conversation resolution before merging

**Do not allow bypassing the above settings:**
- ✅ Do not allow bypassing the above settings
- ⚠️ **Exception:** You may want to allow yourself to bypass if you're the only developer

### Step 3: Save

Click **Create** or **Save changes**

---

## What This Achieves

✅ **No merging failing code** - PRs can't be merged if tests fail  
✅ **Automatic checks** - GitHub runs tests on every push  
✅ **Clear status** - Green checkmark = all tests pass  
✅ **Prevents accidents** - Can't accidentally merge broken code  

---

## Workflow Behavior

### On Push to `main` or `refactor/**` branches:
- Runs all pytest tests
- Reports coverage
- Shows results in GitHub Actions tab

### On Pull Request to `main`:
- Runs all pytest tests
- Blocks merge if tests fail
- Shows status on PR page

---

## Testing the Workflow

### Verify it works:

```bash
# Make a change that breaks tests
echo "assert False" >> tests/test_sample_fail.py
git add tests/test_sample_fail.py
git commit -m "test: Intentionally break tests"
git push origin your-branch

# Create PR to main
# → GitHub should show red X and block merge

# Fix it
git rm tests/test_sample_fail.py
git commit -m "test: Remove broken test"
git push

# → GitHub should show green checkmark and allow merge
```

---

## Current Test Suite

As of Feb 8, 2026:
- **13 test files** (after cleanup)
- **74 tests** total
- **All passing** ✅

Test categories:
- Core logic (screeners, indicators, backtesting)
- Portfolio management
- CLI workflows
- Order management

---

## Notes

- **Coverage not enforced yet** - Consider adding `--cov-fail-under=80` later
- **No frontend tests** - Web UI tests would require Playwright/Cypress setup
- **Manual API tests** - `test_api.sh` is manual only (not in CI)

---

## Future Enhancements

1. **Add coverage threshold:**
   ```yaml
   pytest --cov-fail-under=80
   ```

2. **Add frontend tests:**
   - Setup Playwright or Cypress
   - Add `web-ui-tests` job to workflow

3. **Add linting:**
   ```yaml
   - name: Lint with ruff
     run: ruff check src/ api/ tests/
   ```

4. **Add type checking:**
   ```yaml
   - name: Type check with mypy
     run: mypy src/ api/
   ```
