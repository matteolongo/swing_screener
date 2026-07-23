"""Smoke tests for the backend test-support package."""


def test_support_packages_import():
    import tests.support
    import tests.support.factories
    import tests.support.fakes

    assert tests.support is not None
