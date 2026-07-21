# Lightweight Versioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a root changelog and a lightweight, verified Semantic Versioning workflow with `pyproject.toml` as the canonical application version.

**Architecture:** `src/swing_screener/version.py` reads the canonical project version for the FastAPI/OpenAPI application. `scripts/check_release_version.py` validates the Python source, web manifests, and changelog without third-party dependencies. Repository policy lives only in `AGENTS.md`; `CLAUDE.md` is removed.

**Tech Stack:** Python 3.10+ standard library, FastAPI, pytest, npm package metadata, Markdown.

## Global Constraints

- Keep `pyproject.toml` as the only canonical version value.
- Keep `web-ui/package.json` and the root package entry in `web-ui/package-lock.json` synchronized release mirrors.
- Use SemVer and annotated `vX.Y.Z` tags; do not create the v3.0.0 tag until its release PR merges.
- Preserve the unrelated reversible-portfolio-transfer entry already modified in `docs/overview/INDEX.md`.
- Do not stage unrelated user changes.

---

### Task 1: Add canonical version access and API metadata coverage

**Files:**
- Create: `src/swing_screener/version.py`
- Modify: `api/main.py:1-190`
- Test: `tests/test_version.py`

**Interfaces:**
- Produces: `get_version(project_root: Path | None = None) -> str`
- Consumes: repository-root `pyproject.toml` containing `[project] version = "X.Y.Z"`
- Used by: FastAPI `app.version` and the release checker.

- [ ] **Step 1: Write the failing version-access test**

```python
from pathlib import Path

from swing_screener.version import get_version


def test_get_version_reads_project_metadata(tmp_path: Path):
    (tmp_path / "pyproject.toml").write_text(
        '[project]\nname = "swing-screener"\nversion = "9.8.7"\n',
        encoding="utf-8",
    )

    assert get_version(tmp_path) == "9.8.7"
```

- [ ] **Step 2: Verify the test fails before implementation**

Run: `docker compose exec -T api pytest tests/test_version.py -q`

Expected: import failure for `swing_screener.version`.

- [ ] **Step 3: Add the minimal canonical version reader**

```python
_PROJECT_VERSION = re.compile(r'^version\s*=\s*"(?P<version>[^"]+)"\s*$', re.MULTILINE)


def get_version(project_root: Path | None = None) -> str:
    root = project_root or Path(__file__).resolve().parents[2]
    match = _PROJECT_VERSION.search((root / "pyproject.toml").read_text(encoding="utf-8"))
    if match is None:
        raise RuntimeError("Project version is missing from pyproject.toml")
    return match.group("version")
```

Import `get_version` in `api/main.py` and set `FastAPI(version=get_version())`.

- [ ] **Step 4: Verify version reader and API metadata**

Run: `docker compose exec -T api pytest tests/test_version.py -q`

Expected: PASS.

- [ ] **Step 5: Commit the version access change**

```bash
git add src/swing_screener/version.py api/main.py tests/test_version.py
git commit -m "Read API version from project metadata"
```

### Task 2: Add changelog and release-version verifier

**Files:**
- Create: `CHANGELOG.md`
- Create: `scripts/check_release_version.py`
- Test: `tests/test_release_version.py`

**Interfaces:**
- Produces: `check_release_version(project_root: Path) -> list[str]`
- Consumes: `pyproject.toml`, `web-ui/package.json`, `web-ui/package-lock.json`, `CHANGELOG.md`, and `get_version()`.
- Exit behavior: script prints `Release version check passed: X.Y.Z` and exits 0 when the returned error list is empty; otherwise prints each error and exits 1.

- [ ] **Step 1: Write failing successful and mismatched-release tests**

```python
def test_release_version_check_accepts_matching_metadata(tmp_path: Path):
    _write_release_files(tmp_path, version="9.8.7", changelog_heading="## [9.8.7] - Unreleased")

    assert check_release_version(tmp_path) == []


def test_release_version_check_reports_web_version_mismatch(tmp_path: Path):
    _write_release_files(tmp_path, version="9.8.7", web_version="9.8.6")

    assert check_release_version(tmp_path) == [
        "web-ui/package.json version is 9.8.6; expected 9.8.7"
    ]
```

- [ ] **Step 2: Verify the tests fail before implementation**

Run: `docker compose exec -T api pytest tests/test_release_version.py -q`

Expected: import failure for `scripts.check_release_version`.

- [ ] **Step 3: Implement the stdlib-only verifier**

Use `json`, `Path`, `re`, and `sys`. Read only `package-lock.json["version"]` and `package-lock.json["packages"][""]["version"]`; report each independently if it differs. Require a changelog heading matching either `## [X.Y.Z] - Unreleased` or `## [X.Y.Z] - YYYY-MM-DD`. Do not parse dependency versions from the lockfile.

- [ ] **Step 4: Add the v3.0.0 release-candidate changelog**

Create a Keep a Changelog document with:

```markdown
# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

## [3.0.0] - Unreleased
```

Document the reviewed v3.0.0 work under `Added`, `Changed`, `Fixed`, and `Security`: intelligence decision gates; OIDC/session/CSRF/rate-limit boundary; authoritative order approval; SQL portfolio state and legacy import; idempotency/retry hardening; signed-fee canonicalization; and database URL/readiness behavior.

- [ ] **Step 5: Verify checker behavior and real repository metadata**

Run:

```bash
docker compose exec -T api pytest tests/test_release_version.py tests/test_version.py -q
docker compose exec -T api python scripts/check_release_version.py
```

Expected: all tests pass and the script reports `Release version check passed: 3.0.0`.

- [ ] **Step 6: Commit the changelog and verifier**

```bash
git add CHANGELOG.md scripts/check_release_version.py tests/test_release_version.py
git commit -m "Add lightweight release version checks"
```

### Task 3: Consolidate repository governance and release instructions

**Files:**
- Modify: `AGENTS.md`
- Delete: `CLAUDE.md`
- Modify: `docs/overview/INDEX.md`

**Interfaces:**
- Produces: one authoritative contributor-policy file at repository root.
- Consumes: release verifier command from Task 2.
- Used by: human contributors and coding agents before every release.

- [ ] **Step 1: Add release policy to `AGENTS.md`**

Add a `Versioning and releases` section that specifies:

```markdown
- `pyproject.toml` is the canonical app version.
- Keep `web-ui/package.json` and both root version fields in `web-ui/package-lock.json` equal to it.
- Add changes under `CHANGELOG.md` → `Unreleased`; finalize them in `X.Y.Z` on release.
- Run `python scripts/check_release_version.py` before every release commit.
- Use patch/minor/major according to the project SemVer policy, commit `Release vX.Y.Z`, and create annotated tag `vX.Y.Z` only after the release PR merges.
```

- [ ] **Step 2: Remove duplicate instructions and repair the documentation index**

Delete `CLAUDE.md`. In `docs/overview/INDEX.md`, replace the entry-point link to `CLAUDE.md` with `AGENTS.md`; add tracked links for `CHANGELOG.md`, the versioning design, and this plan. Preserve the already-present reversible-portfolio-transfer plan entry unchanged.

- [ ] **Step 3: Verify documentation links and release policy references**

Run:

```bash
test ! -e CLAUDE.md
rg -n 'CLAUDE\.md' README.md docs/overview AGENTS.md || true
rg -n 'check_release_version|pyproject\.toml|CHANGELOG\.md|vX\.Y\.Z' AGENTS.md
git diff --check
```

Expected: no active contributor/documentation index link points to `CLAUDE.md`; `AGENTS.md` contains all four release policy anchors.

- [ ] **Step 4: Commit only governance changes**

Stage `AGENTS.md`, `CLAUDE.md`, and the versioning-specific `docs/overview/INDEX.md` hunks without staging the unrelated portfolio-transfer hunk. Then commit:

```bash
git commit -m "Document release versioning policy"
```

### Task 4: Run release-level verification and update the existing PR

**Files:**
- Modify: PR #426 description

**Interfaces:**
- Consumes: `scripts/check_release_version.py`, backend tests, frontend package metadata, and existing PR #426.
- Produces: a release PR that documents the changelog and versioning policy.

- [ ] **Step 1: Run backend and release checks**

Run:

```bash
docker compose exec -T api pytest tests/test_version.py tests/test_release_version.py tests/db/test_legacy_import.py tests/db/test_readiness.py -q
docker compose exec -T api ruff check src/swing_screener/version.py api/main.py scripts/check_release_version.py tests/test_version.py tests/test_release_version.py
docker compose exec -T api python scripts/check_release_version.py
```

- [ ] **Step 2: Run web metadata verification**

Run:

```bash
cd web-ui && npm run typecheck && npm test -- --run src/lib/apiFetch.test.ts
```

- [ ] **Step 3: Publish and describe the update**

Push `feat/backend-auth-boundary`, update PR #426's release description to link the changelog and state that the release checker guards metadata drift, then verify the remote head SHA matches the local commit.

- [ ] **Step 4: Write `prs.md` delivery output**

Write the required compare URL, imperative release title, and a concise description naming the changelog, canonical version source, verifier, governance consolidation, and verification status.
