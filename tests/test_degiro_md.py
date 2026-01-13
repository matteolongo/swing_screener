from swing_screener.portfolio.state import PositionUpdate, render_degiro_actions_md


def test_render_degiro_actions_md_contains_sections():
    updates = [
        PositionUpdate(
            ticker="AAA",
            status="open",
            last=110.0,
            entry=100.0,
            stop_old=90.0,
            stop_suggested=100.0,
            shares=1,
            r_now=1.0,
            action="MOVE_STOP_UP",
            reason="Breakeven",
        ),
        PositionUpdate(
            ticker="BBB",
            status="open",
            last=89.0,
            entry=100.0,
            stop_old=90.0,
            stop_suggested=90.0,
            shares=1,
            r_now=-1.1,
            action="CLOSE_STOP_HIT",
            reason="Stop hit",
        ),
        PositionUpdate(
            ticker="CCC",
            status="open",
            last=101.0,
            entry=100.0,
            stop_old=95.0,
            stop_suggested=95.0,
            shares=1,
            r_now=0.1,
            action="NO_ACTION",
            reason="No rule",
        ),
    ]

    md = render_degiro_actions_md(updates)

    assert "# Degiro Actions" in md
    assert "## 1) MOVE STOP" in md
    assert "## 2) CLOSE" in md
    assert "## 3) NO ACTION" in md
    assert "**AAA**" in md
    assert "**BBB**" in md
    assert "**CCC**" in md
