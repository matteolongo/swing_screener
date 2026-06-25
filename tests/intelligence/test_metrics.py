from __future__ import annotations

import json


def test_record_analysis_metrics_appends(tmp_path):
    from swing_screener.intelligence.metrics import record_analysis_metrics

    record_analysis_metrics("AAA", tokens=123, metrics_root=tmp_path)
    data = json.loads((tmp_path / "intelligence_metrics.json").read_text())
    assert data[-1]["ticker"] == "AAA" and data[-1]["tokens"] == 123


def test_record_analysis_metrics_appends_multiple(tmp_path):
    from swing_screener.intelligence.metrics import record_analysis_metrics

    record_analysis_metrics("AAA", tokens=100, metrics_root=tmp_path)
    record_analysis_metrics("BBB", tokens=200, metrics_root=tmp_path)
    data = json.loads((tmp_path / "intelligence_metrics.json").read_text())
    assert len(data) == 2
    assert data[0]["ticker"] == "AAA"
    assert data[1]["ticker"] == "BBB"


def test_record_analysis_metrics_caps_at_500(tmp_path):
    from swing_screener.intelligence.metrics import record_analysis_metrics

    for i in range(505):
        record_analysis_metrics("T", tokens=i, metrics_root=tmp_path)
    data = json.loads((tmp_path / "intelligence_metrics.json").read_text())
    assert len(data) == 500


def test_record_analysis_metrics_none_tokens(tmp_path):
    from swing_screener.intelligence.metrics import record_analysis_metrics

    record_analysis_metrics("ZZZ", tokens=None, metrics_root=tmp_path)
    data = json.loads((tmp_path / "intelligence_metrics.json").read_text())
    assert data[-1]["ticker"] == "ZZZ"
    assert data[-1]["tokens"] is None


def test_record_self_heals_corrupt_file(tmp_path):
    from swing_screener.intelligence.metrics import record_analysis_metrics

    (tmp_path / "intelligence_metrics.json").write_text("{ this is not json")
    record_analysis_metrics("AAA", tokens=5, metrics_root=tmp_path)
    data = json.loads((tmp_path / "intelligence_metrics.json").read_text())
    assert isinstance(data, list) and data[-1]["ticker"] == "AAA"


def test_record_analysis_metrics_soft_degrades_on_write_failure(tmp_path, monkeypatch):
    from swing_screener.intelligence.metrics import record_analysis_metrics

    monkeypatch.setattr("pathlib.Path.write_text", lambda *_args, **_kwargs: (_ for _ in ()).throw(OSError("disk full")))
    # must not raise — degrade soft
    record_analysis_metrics("AAA", tokens=1, metrics_root=tmp_path)
