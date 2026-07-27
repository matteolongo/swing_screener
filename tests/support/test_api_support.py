"""Contract tests for API support helpers."""

import pytest
from fastapi import FastAPI

from tests.support.api import dependency_overrides


def test_dependency_overrides_restore_previous_mapping_on_success():
    app = FastAPI()

    def existing():
        return "existing"

    def added():
        return "added"

    def previous():
        return "old"

    app.dependency_overrides[existing] = previous
    with dependency_overrides(app, {added: lambda: "new"}):
        assert app.dependency_overrides[existing]() == "old"
        assert app.dependency_overrides[added]() == "new"
    assert app.dependency_overrides == {existing: previous}
    assert added not in app.dependency_overrides


def test_dependency_overrides_restore_after_exception():
    app = FastAPI()
    with pytest.raises(RuntimeError):
        with dependency_overrides(app, {}):
            raise RuntimeError("boom")
    assert app.dependency_overrides == {}
