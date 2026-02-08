from __future__ import annotations

from pathlib import Path
import datetime as dt
import json
import uuid


BACKTEST_DIR = Path("out/backtests")


def _ensure_dir() -> None:
    BACKTEST_DIR.mkdir(parents=True, exist_ok=True)


def _generate_id() -> str:
    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    rand = uuid.uuid4().hex[:6]
    return f"{stamp}_{rand}"


def save_simulation(payload: dict) -> dict:
    _ensure_dir()
    sim_id = payload.get("id") or _generate_id()
    created_at = payload.get("created_at") or dt.datetime.now().isoformat()
    payload["id"] = sim_id
    payload["created_at"] = created_at

    path = BACKTEST_DIR / f"{sim_id}.json"
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")
    return {"id": sim_id, "created_at": created_at, "path": str(path)}


def list_simulations() -> list[dict]:
    _ensure_dir()
    sims: list[dict] = []
    for path in sorted(BACKTEST_DIR.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        sims.append(_extract_meta(data))
    sims.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return sims


def load_simulation(sim_id: str) -> dict:
    _ensure_dir()
    path = BACKTEST_DIR / f"{sim_id}.json"
    if not path.exists():
        raise FileNotFoundError(sim_id)
    return json.loads(path.read_text(encoding="utf-8"))


def delete_simulation(sim_id: str) -> None:
    _ensure_dir()
    path = BACKTEST_DIR / f"{sim_id}.json"
    if not path.exists():
        raise FileNotFoundError(sim_id)
    path.unlink()


def _extract_meta(payload: dict) -> dict:
    params = payload.get("params", {}) if isinstance(payload, dict) else {}
    result = payload.get("result", {}) if isinstance(payload, dict) else {}
    summary = result.get("summary", {}) if isinstance(result, dict) else {}

    return {
        "id": payload.get("id"),
        "name": payload.get("name"),
        "created_at": payload.get("created_at"),
        "tickers": params.get("tickers", []),
        "start": params.get("start"),
        "end": params.get("end"),
        "entry_type": params.get("entry_type"),
        "trades": summary.get("trades"),
    }
