from swing_screener.errors import NotFoundError
from agent.cli import render_domain_error


def test_render_domain_error_returns_message_and_exit_code(capsys):
    code = render_domain_error(NotFoundError("Position not found: P1"))
    out = capsys.readouterr()
    assert code == 1
    assert "Position not found: P1" in (out.err + out.out)
