import pytest
from swing_screener.errors import (
    DomainError, NotFoundError, ValidationError, ConflictError,
    UnprocessableError, ServiceError, UpstreamError,
)


@pytest.mark.parametrize(
    "exc_cls, expected_status",
    [
        (NotFoundError, 404),
        (ValidationError, 400),
        (ConflictError, 409),
        (UnprocessableError, 422),
        (ServiceError, 500),
        (UpstreamError, 502),
    ],
)
def test_each_error_carries_its_http_status(exc_cls, expected_status):
    err = exc_cls("boom")
    assert isinstance(err, DomainError)
    assert err.http_status == expected_status
    assert err.detail == "boom"
    assert str(err) == "boom"


def test_domain_error_is_not_an_httpexception():
    err = NotFoundError("x")
    assert "fastapi" not in type(err).__module__
