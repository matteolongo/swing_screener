import sys
from unittest.mock import MagicMock

from swing_screener.errors import NotFoundError
from agent.cli import render_domain_error


def test_render_domain_error_returns_message_and_exit_code(capsys):
    code = render_domain_error(NotFoundError("Position not found: P1"))
    out = capsys.readouterr()
    assert code == 1
    assert "Position not found: P1" in (out.err + out.out)


def test_domain_error_propagates_from_command_to_main(monkeypatch, capsys):
    """DomainError raised inside a cmd_* handler reaches main()'s handler,
    exits with code 1, and prints the detail to stderr."""
    error_detail = "Position not found: TEST-99"
    mock_service = MagicMock()
    mock_service.list_positions.side_effect = NotFoundError(error_detail)

    import agent.cli as cli_module
    monkeypatch.setattr(cli_module, "_portfolio_service", lambda: mock_service)
    monkeypatch.setattr(sys, "argv", ["cli", "positions", "review"])

    exit_code = cli_module.main()

    captured = capsys.readouterr()
    assert exit_code == 1
    assert error_detail in captured.err
