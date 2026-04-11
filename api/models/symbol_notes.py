from __future__ import annotations

from typing import Optional

from pydantic import BaseModel

class SymbolNote(BaseModel):
    ticker: str
    note: Optional[str] = None
    updated_at: Optional[str] = None

class SymbolNoteUpsertRequest(BaseModel):
    note: str

class SymbolNoteDeleteResponse(BaseModel):
    deleted: bool
