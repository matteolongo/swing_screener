from __future__ import annotations
from pydantic import BaseModel

class SymbolNote(BaseModel):
    ticker: str
    note: str
    updated_at: str

class SymbolNoteUpsertRequest(BaseModel):
    note: str

class SymbolNoteDeleteResponse(BaseModel):
    deleted: bool
