# Lightweight Versioning Design

## Goal

Establish a small, reviewable Semantic Versioning release process for Swing
Screener. It must keep Python package metadata, the FastAPI/OpenAPI version,
the web package metadata, and release notes aligned without introducing a
release-management service.

## Context

The v3.0.0 release currently repeats its version in `pyproject.toml`,
`api/main.py`, `web-ui/package.json`, and `web-ui/package-lock.json`. There is
no root changelog, no Git release tags, and the repository's contributor rules
are duplicated in `CLAUDE.md` and the untracked `AGENTS.md`.

## Alternatives considered

1. Continue manually editing each version surface. This has no implementation
   cost but allows version drift and does not provide a release record.
2. Use a canonical Python version plus a stdlib release verifier. This keeps
   the workflow lightweight, makes runtime API metadata derive from the package
   version, and catches unavoidable web-package mirrors before release.
3. Adopt Conventional Commits and an automated release service. This offers
   automated bump proposals but adds commit-format enforcement, external
   configuration, and operational complexity that this repository does not
   need today.

The project adopts option 2.

## Version source and mirrors

`pyproject.toml` is the canonical release version. The API reads the installed
distribution metadata for its OpenAPI version rather than containing a second
literal. `web-ui/package.json` and the root package entry in
`web-ui/package-lock.json` are required mirrors because the web project has its
own package manifest.

`scripts/check_release_version.py` will use only the Python standard library.
It will extract the project version from `pyproject.toml`, compare it with the
web manifest and lockfile root versions, verify the API version helper returns
the same value, and require a matching `## [X.Y.Z]` section in
`CHANGELOG.md`. It exits non-zero and reports each mismatch.

## Changelog

Create root `CHANGELOG.md` in Keep a Changelog format. It contains an
`Unreleased` section and a `3.0.0` release-candidate section with the current
release work, marked `Unreleased` until the annotated Git tag is created. Each
future release moves reviewed entries from `Unreleased` into an ISO-dated
`## [X.Y.Z] - YYYY-MM-DD` section. Do not invent entries for historical releases
that have no tags or curated release notes.

## Semantic Versioning policy

- Patch (`X.Y.Z+1`): backwards-compatible bug fixes, security fixes, and
  documentation-only corrections.
- Minor (`X.Y+1.0`): backwards-compatible endpoints, user-visible features,
  configuration, or workflow additions.
- Major (`X+1.0.0`): incompatible API, persisted-data, configuration, or
  operational changes that require an explicit migration or consumer action.

Pre-release identifiers may be used only when a version is intentionally
published for testing; they follow SemVer (for example `3.1.0-rc.1`).

## Release procedure

1. Select the SemVer bump and add a concise `Unreleased` changelog entry while
   implementing the change.
2. At release time, set the canonical version, synchronize the web manifest
   and lockfile, and finalize the changelog section date.
3. Run `python scripts/check_release_version.py` and the normal backend and web
   verification commands.
4. Commit the release as `Release vX.Y.Z`, create annotated tag `vX.Y.Z`, then
   create the GitHub release from that changelog section.

## Repository governance

`AGENTS.md` is the only contributor-instruction file. Its versioning rules must
describe the source of truth, mirrors, bump policy, verification command, tag
format, and release-commit convention. Delete the duplicate `CLAUDE.md` and
change the documentation index to link to `AGENTS.md`. Historical plans may
retain references to `CLAUDE.md` because they describe past work.

## Testing and verification

Unit tests cover runtime version resolution and successful and failing release
checker scenarios using temporary manifests/changelog files. The real-project
checker, backend test suite relevant to version metadata, frontend typecheck or
test coverage for any affected package metadata, and `git diff --check` are
run before delivery.
