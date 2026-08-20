"""Shared API test fixtures."""

from __future__ import annotations

import sys

import pytest

from tests.support.api import dependency_overrides as dependency_overrides_context
from tests.support.fakes.services import PortfolioServiceStub
from tests.support.state import JsonPortfolioState


@pytest.fixture(autouse=True)
def _isolate_review_queue(tmp_path_factory):
    """Point the review-queue store at a tmp file for every API test.

    The screener writes per-symbol fetch health on every run. Without isolation
    those writes land in the repo's ``data/review_queue.json`` and leak across
    tests (queued symbols get excluded from later screens). Override the FastAPI
    dependency so each test session uses a throwaway file. The committed
    ``symbol_pool.json`` is read-only, so it needs no isolation.
    """
    main_module = sys.modules.get("api.main")
    if main_module is None:
        yield
        return

    app = main_module.app
    from api.dependencies import get_review_queue_repo
    from api.repositories.review_queue_repo import ReviewQueueRepository

    queue_path = tmp_path_factory.mktemp("review_queue") / "review_queue.json"
    app.dependency_overrides[get_review_queue_repo] = lambda: ReviewQueueRepository(
        queue_path
    )
    yield
    app.dependency_overrides.pop(get_review_queue_repo, None)


@pytest.fixture
def api_client():
    from api.main import app
    from tests.support.api import api_client as make_api_client

    return make_api_client(app)


@pytest.fixture
def portfolio_state(tmp_path, monkeypatch):
    state = JsonPortfolioState(tmp_path / "positions.json", tmp_path / "orders.json")
    state.write()
    return state.install(monkeypatch)


@pytest.fixture
def portfolio_service_stub():
    return PortfolioServiceStub()


@pytest.fixture
def override_dependencies():
    from api.main import app

    def override(mapping):
        return dependency_overrides_context(app, mapping)

    return override
