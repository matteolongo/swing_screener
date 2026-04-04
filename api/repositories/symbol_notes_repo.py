"""Symbol notes repository — per-ticker persistent text notes."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from api.models.symbol_notes import SymbolNote, SymbolNoteUpsertRequest
from api.utils.file_lock import locked_read_json, locked_write_json


@dataclass
class SymbolNotesRepository:
    path: Path

    def _read_notes(self) -> dict[str, dict]:
        if not self.path.exists():
            return {}
        payload = locked_read_json(self.path)
        if not isinstance(payload, dict):
            return {}
        raw = payload.get("notes", {})
        if not isinstance(raw, dict):
            return {}
        return raw

    def _write_notes(self, notes: dict[str, dict]) -> None:
        locked_write_json(self.path, {"notes": notes})

    def list_notes(self) -> list[SymbolNote]:
        notes = self._read_notes()
        result = []
        for raw in notes.values():
            try:
                result.append(SymbolNote.model_validate(raw))
            except Exception:
                continue
        return sorted(result, key=lambda n: n.ticker)

    def get_note(self, ticker: str) -> SymbolNote | None:
        normalized = str(ticker).strip().upper()
        notes = self._read_notes()
        raw = notes.get(normalized)
        if raw is None:
            return None
        try:
            return SymbolNote.model_validate(raw)
        except Exception:
            return None

    def upsert_note(self, ticker: str, request: SymbolNoteUpsertRequest) -> SymbolNote:
        normalized = str(ticker).strip().upper()
        notes = self._read_notes()
        updated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        note = SymbolNote(ticker=normalized, note=request.note, updated_at=updated_at)
        notes[normalized] = note.model_dump(mode="json")
        self._write_notes(notes)
        return note

    def delete_note(self, ticker: str) -> bool:
        normalized = str(ticker).strip().upper()
        notes = self._read_notes()
        if normalized not in notes:
            return False
        del notes[normalized]
        self._write_notes(notes)
        return True
