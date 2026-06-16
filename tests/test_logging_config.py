import logging
from swing_screener.utils.logging_config import get_logger


def test_get_logger_returns_namespaced_logger():
    log = get_logger("swing_screener.demo")
    assert isinstance(log, logging.Logger)
    assert log.name == "swing_screener.demo"
