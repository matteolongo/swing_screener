"""Shared API test fixtures."""

from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _isolate_review_queue(tmp_path_factory):
    """Point the review-queue store at a tmp file for every API test.

    The screener writes per-symbol fetch health on every run. Without isolation
    those writes land in the repo's ``data/review_queue.json`` and leak across
    tests (queued symbols get excluded from later screens). Override the FastAPI
    dependency so each test session uses a throwaway file. The committed
    ``symbol_pool.json`` is read-only, so it needs no isolation.
    """
    from api.main import app
    from api.dependencies import get_review_queue_repo
    from api.repositories.review_queue_repo import ReviewQueueRepository

    queue_path = tmp_path_factory.mktemp("review_queue") / "review_queue.json"
    app.dependency_overrides[get_review_queue_repo] = lambda: ReviewQueueRepository(
        queue_path
    )
    yield
    app.dependency_overrides.pop(get_review_queue_repo, None)
