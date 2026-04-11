"""Symbol notes router — per-ticker persistent text notes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import get_symbol_notes_repo
from api.models.symbol_notes import SymbolNote, SymbolNoteDeleteResponse, SymbolNoteUpsertRequest
from api.repositories.symbol_notes_repo import SymbolNotesRepository

router = APIRouter()


@router.get("", response_model=list[SymbolNote])
async def list_notes(repo: SymbolNotesRepository = Depends(get_symbol_notes_repo)):
    return repo.list_notes()


@router.get("/{ticker}", response_model=SymbolNote)
async def get_note(ticker: str, repo: SymbolNotesRepository = Depends(get_symbol_notes_repo)):
    note = repo.get_note(ticker.upper())
    if not note:
        return SymbolNote(ticker=ticker.upper())
    return note


@router.put("/{ticker}", response_model=SymbolNote)
async def upsert_note(
    ticker: str,
    request: SymbolNoteUpsertRequest,
    repo: SymbolNotesRepository = Depends(get_symbol_notes_repo),
):
    return repo.upsert_note(ticker.upper(), request)


@router.delete("/{ticker}", response_model=SymbolNoteDeleteResponse)
async def delete_note(ticker: str, repo: SymbolNotesRepository = Depends(get_symbol_notes_repo)):
    deleted = repo.delete_note(ticker.upper())
    if not deleted:
        raise HTTPException(status_code=404, detail="Note not found")
    return SymbolNoteDeleteResponse(deleted=True)
