"""Tests for trade tagging on position close."""

import pytest
from tests.support.factories.portfolio import position_payload


@pytest.fixture
def client_with_open_position(portfolio_state, api_client):
    portfolio_state.write(
        positions=[
            position_payload(
                position_id="POS-TAG-001",
                initial_risk=50.0,
            )
        ]
    )
    return api_client


def test_close_with_tags_stores_tags(client_with_open_position):
    response = client_with_open_position.post(
        "/api/portfolio/positions/POS-TAG-001/close",
        json={
            "exit_price": 110.0,
            "tags": ["breakout", "stop_hit"],
        },
        headers={"Idempotency-Key": "close-tagged-position"},
    )
    assert response.status_code == 200

    resp = client_with_open_position.get("/api/portfolio/positions/POS-TAG-001")
    assert resp.status_code == 200
    assert set(resp.json()["tags"]) == {"breakout", "stop_hit"}


def test_close_without_tags_stores_empty_list(client_with_open_position):
    response = client_with_open_position.post(
        "/api/portfolio/positions/POS-TAG-001/close",
        json={"exit_price": 110.0},
        headers={"Idempotency-Key": "close-untagged-position"},
    )
    assert response.status_code == 200

    resp = client_with_open_position.get("/api/portfolio/positions/POS-TAG-001")
    assert resp.json()["tags"] == []
