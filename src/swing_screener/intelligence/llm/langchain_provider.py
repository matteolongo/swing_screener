"""LangChain-backed provider implementations."""
from __future__ import annotations

import json
import re
from typing import Any, Optional

from pydantic import ValidationError

from swing_screener.runtime_env import get_openai_api_key, get_openai_base_url

from .client import LLMProvider
from .prompts import (
    build_prompt_fingerprint,
    build_user_prompt,
    resolve_system_prompt,
    resolve_user_prompt_template,
)
from .schemas import EventClassification


def _collect_text_fragments(value: Any, fragments: list[str]) -> None:
    if value is None:
        return
    if isinstance(value, str):
        text = value.strip()
        if text:
            fragments.append(text)
        return
    if isinstance(value, list):
        for item in value:
            _collect_text_fragments(item, fragments)
        return
    if isinstance(value, dict):
        preferred_keys = ("text", "content", "output_text", "input_text", "refusal")
        seen_preferred = False
        for key in preferred_keys:
            if key in value:
                seen_preferred = True
                _collect_text_fragments(value.get(key), fragments)
        if not seen_preferred:
            for nested in value.values():
                if isinstance(nested, (str, list, dict)):
                    _collect_text_fragments(nested, fragments)


def _coerce_content_text(raw_content: Any) -> str:
    fragments: list[str] = []
    _collect_text_fragments(raw_content, fragments)
    if fragments:
        return "\n".join(fragments).strip()
    return str(raw_content or "").strip()


def _strip_markdown_fence(text: str) -> str:
    value = str(text or "").strip()
    if not value.startswith("```"):
        return value
    lines = value.splitlines()
    if len(lines) >= 2 and lines[-1].strip() == "```":
        body = "\n".join(lines[1:-1]).strip()
        return body
    return value.strip("`").strip()


def _preview_text(raw_content: Any, *, max_chars: int = 220) -> str:
    text = " ".join(_coerce_content_text(raw_content).split())
    if not text:
        return "<empty>"
    if len(text) <= max_chars:
        return text
    return f"{text[: max_chars - 3]}..."


def _extract_finish_reason(response: Any) -> str:
    metadata = getattr(response, "response_metadata", None)
    if isinstance(metadata, dict):
        value = metadata.get("finish_reason")
        if value is not None and str(value).strip():
            return str(value).strip()
    return "unknown"


def _build_json_error_details(response: Any, raw_content: Any) -> str:
    content_text = _coerce_content_text(raw_content)
    return (
        f"content_type={type(raw_content).__name__} "
        f"content_length={len(content_text)} "
        f"finish_reason={_extract_finish_reason(response)} "
        f"content_preview={_preview_text(raw_content)}"
    )


def _extract_json_payload(raw_content: Any) -> dict:
    if isinstance(raw_content, dict):
        return raw_content
    text = _strip_markdown_fence(_coerce_content_text(raw_content))
    try:
        return json.loads(text)
    except json.JSONDecodeError as decode_exc:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(text[start : end + 1])
        kv_payload = _extract_key_value_payload(text)
        if kv_payload is not None:
            return kv_payload
        raise decode_exc


def _extract_key_value_payload(text: str) -> dict | None:
    normalized = str(text or "").replace("\r", " ").replace("\n", " ")
    normalized = normalized.replace("→", " ").replace("->", " ")

    def _strip_quotes(value: str) -> str:
        text_value = str(value).strip()
        if len(text_value) >= 2 and text_value[0] == text_value[-1] and text_value[0] in {"'", '"'}:
            return text_value[1:-1].strip()
        return text_value

    def _normalize_symbol(value: str | None) -> str | None:
        if value is None:
            return None
        text_value = _strip_quotes(value).strip().upper()
        if text_value in {"", "NONE", "NULL", "N/A"}:
            return None
        direct = re.fullmatch(r"[A-Z]{1,5}", text_value)
        if direct:
            return text_value
        prefix = re.match(r"[A-Z]{1,5}", text_value)
        if prefix:
            return prefix.group(0)
        return None

    def _parse_symbols_list(value: str | None) -> list[str]:
        if value is None:
            return []
        text_value = _strip_quotes(value).strip()
        if text_value.lower() in {"", "none", "null", "[]"}:
            return []
        if text_value.startswith("[") and text_value.endswith("]"):
            try:
                parsed = json.loads(text_value)
                if isinstance(parsed, list):
                    out: list[str] = []
                    seen: set[str] = set()
                    for item in parsed:
                        symbol = _normalize_symbol(str(item))
                        if symbol and symbol not in seen:
                            seen.add(symbol)
                            out.append(symbol)
                    return out
            except json.JSONDecodeError:
                pass
        out: list[str] = []
        seen: set[str] = set()
        for token in re.split(r"[,\s]+", text_value):
            symbol = _normalize_symbol(token)
            if symbol and symbol not in seen:
                seen.add(symbol)
                out.append(symbol)
        return out

    event_type_match = re.search(r"\bevent[_\s-]*type\s*:\s*\"?([A-Z_]+)\"?\b", normalized, flags=re.IGNORECASE)
    severity_match = re.search(r"\bseverity\s*:\s*\"?(LOW|MEDIUM|HIGH)\"?\b", normalized, flags=re.IGNORECASE)
    primary_match = re.search(
        r"\bprimary[_\s-]*symbol\s*:\s*(.+?)(?=\bsecondary[_\s-]*symbols?\s*:|\bis[_\s-]*material\s*:|\bconfidence(?:[_\s-]*score)?\s*:|\bsummary\s*:|$)",
        normalized,
        flags=re.IGNORECASE,
    )
    secondary_match = re.search(
        r"\bsecondary[_\s-]*symbols?\s*:\s*(.+?)(?=\bis[_\s-]*material\s*:|\bconfidence(?:[_\s-]*score)?\s*:|\bsummary\s*:|$)",
        normalized,
        flags=re.IGNORECASE,
    )
    material_match = re.search(r"\bis[_\s-]*material\s*:\s*(true|false)\b", normalized, flags=re.IGNORECASE)
    confidence_match = re.search(
        r"\bconfidence(?:[_\s-]*score)?\s*:\s*([0-9]*\.?[0-9]+)\b",
        normalized,
        flags=re.IGNORECASE,
    )
    summary_quoted_match = re.search(r"\bsummary\s*:\s*\"([^\"]+)\"", normalized, flags=re.IGNORECASE)
    summary_unquoted_match = re.search(
        r"\bsummary\s*:\s*(.+?)(?=\bconfidence(?:[_\s-]*score)?\s*:|$)",
        normalized,
        flags=re.IGNORECASE,
    )

    event_type = event_type_match.group(1) if event_type_match else None
    severity = severity_match.group(1) if severity_match else None
    primary_symbol = primary_match.group(1).strip().strip(",") if primary_match else None
    secondary_symbols = secondary_match.group(1).strip().strip(",") if secondary_match else None
    is_material = material_match.group(1) if material_match else None
    confidence = confidence_match.group(1) if confidence_match else None
    if summary_quoted_match:
        summary = summary_quoted_match.group(1)
    elif summary_unquoted_match:
        summary = summary_unquoted_match.group(1).strip().strip(",")
    else:
        summary = None

    if not event_type or not severity or not is_material or not summary:
        return None

    material_text = _strip_quotes(is_material).strip().lower()
    if material_text not in {"true", "false"}:
        return None

    confidence_value = 0.5
    if confidence is not None:
        try:
            confidence_value = float(_strip_quotes(confidence))
        except ValueError:
            confidence_value = 0.5

    return {
        "event_type": _strip_quotes(event_type).strip().upper(),
        "severity": _strip_quotes(severity).strip().upper(),
        "primary_symbol": _normalize_symbol(primary_symbol),
        "secondary_symbols": _parse_symbols_list(secondary_symbols),
        "is_material": material_text == "true",
        "confidence": max(0.0, min(1.0, confidence_value)),
        "summary": _strip_quotes(summary),
    }


def _normalize_symbol_candidate(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip().strip(",")
    if not text:
        return None
    cleaned = text.strip("'\"").strip().upper()
    if cleaned in {"", "NONE", "NULL", "N/A"}:
        return None
    if re.fullmatch(r"[A-Z]{1,5}", cleaned):
        return cleaned
    paren = re.search(r"\(([A-Z]{1,5})\)", cleaned)
    if paren:
        return paren.group(1)
    if " " in cleaned:
        prefixed = re.match(r"^([A-Z]{1,5})\s*[-:|]", cleaned)
        if prefixed:
            return prefixed.group(1)
        return None
    dotted = re.search(r"\b([A-Z]{1,5})\.[A-Z]{1,4}\b", cleaned)
    if dotted:
        return dotted.group(1)
    prefixed = re.match(r"^([A-Z]{1,5})(?:\b|[,:;])", cleaned)
    if prefixed:
        return prefixed.group(1)
    return None


def _normalize_event_type(value: Any) -> Any:
    if value is None:
        return value
    text = str(value).strip().upper().replace("-", "_")
    aliases = {
        "M&A": "M_AND_A",
        "M_AND_A": "M_AND_A",
        "MERGERS_AND_ACQUISITIONS": "M_AND_A",
    }
    return aliases.get(text, text)


def _normalize_severity(value: Any) -> Any:
    if value is None:
        return value
    text = str(value).strip().upper()
    aliases = {"MID": "MEDIUM"}
    return aliases.get(text, text)


def _normalize_is_material(value: Any) -> Any:
    if isinstance(value, bool):
        return value
    if value is None:
        return value
    text = str(value).strip().lower()
    if text in {"true", "1", "yes"}:
        return True
    if text in {"false", "0", "no"}:
        return False
    return value


def _normalize_confidence(value: Any) -> Any:
    if value is None:
        return value
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return value
    return max(0.0, min(1.0, numeric))


def _normalize_secondary_symbols(value: Any) -> list[str]:
    if value is None:
        return []
    candidates: list[Any]
    if isinstance(value, list):
        candidates = value
    elif isinstance(value, tuple):
        candidates = list(value)
    elif isinstance(value, str):
        text = value.strip()
        if not text:
            return []
        if text.startswith("[") and text.endswith("]"):
            try:
                decoded = json.loads(text)
                if isinstance(decoded, list):
                    candidates = decoded
                else:
                    candidates = [text]
            except json.JSONDecodeError:
                candidates = re.split(r"[,\s]+", text)
        else:
            candidates = re.split(r"[,\s]+", text)
    else:
        candidates = [value]

    out: list[str] = []
    seen: set[str] = set()
    for item in candidates:
        symbol = _normalize_symbol_candidate(item)
        if symbol and symbol not in seen:
            seen.add(symbol)
            out.append(symbol)
    return out


def _normalize_payload_for_validation(payload: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(payload)
    if "event_type" in normalized:
        normalized["event_type"] = _normalize_event_type(normalized.get("event_type"))
    if "severity" in normalized:
        normalized["severity"] = _normalize_severity(normalized.get("severity"))
    if "primary_symbol" in normalized:
        normalized["primary_symbol"] = _normalize_symbol_candidate(normalized.get("primary_symbol"))
    if "secondary_symbols" in normalized:
        normalized["secondary_symbols"] = _normalize_secondary_symbols(normalized.get("secondary_symbols"))
    if "primary_symbol" in normalized and isinstance(normalized.get("secondary_symbols"), list):
        primary = normalized.get("primary_symbol")
        if primary:
            normalized["secondary_symbols"] = [
                symbol for symbol in normalized["secondary_symbols"] if symbol != primary
            ]
    if "is_material" in normalized:
        normalized["is_material"] = _normalize_is_material(normalized.get("is_material"))
    if "confidence" in normalized:
        normalized["confidence"] = _normalize_confidence(normalized.get("confidence"))
    if "summary" in normalized and normalized.get("summary") is not None:
        normalized["summary"] = str(normalized.get("summary")).strip()
    return normalized


def _preview_payload(payload: dict[str, Any], *, max_chars: int = 220) -> str:
    text = json.dumps(payload, ensure_ascii=True, separators=(",", ":"))
    if len(text) <= max_chars:
        return text
    return f"{text[: max_chars - 3]}..."


class LangChainOpenAIProvider(LLMProvider):
    """LLM provider using LangChain + OpenAI chat models."""

    def __init__(
        self,
        model: str = "gpt-4.1-mini",
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        system_prompt: Optional[str] = None,
        user_prompt_template: Optional[str] = None,
    ) -> None:
        self._model = str(model).strip() or "gpt-4.1-mini"
        self._base_url = base_url or get_openai_base_url()
        self._api_key = str(api_key or get_openai_api_key()).strip()
        self._system_prompt = resolve_system_prompt(system_prompt)
        self._user_prompt_template = resolve_user_prompt_template(user_prompt_template)
        self._prompt_version = build_prompt_fingerprint(
            system_prompt_override=self._system_prompt,
            user_prompt_template_override=self._user_prompt_template,
        )
        self._llm = None

    def _get_llm(self):
        if self._llm is None:
            if not self._api_key:
                raise RuntimeError("OPENAI API key is required for provider 'openai'.")
            try:
                from langchain_openai import ChatOpenAI
            except ImportError as exc:
                raise RuntimeError(
                    "langchain-openai is not installed. Install dependencies for OpenAI integration."
                ) from exc

            self._llm = ChatOpenAI(
                model=self._model,
                temperature=0,
                api_key=self._api_key,
                base_url=self._base_url,
                max_retries=0,
            )
        return self._llm

    def is_available(self) -> bool:
        return bool(self._api_key)

    @property
    def model_name(self) -> str:
        return self._model

    @property
    def prompt_version(self) -> str:
        return self._prompt_version

    @property
    def prompt_cache_key(self) -> str:
        return self._prompt_version

    def classify_event(self, headline: str, snippet: str = "") -> EventClassification:
        if not self.is_available():
            raise RuntimeError("OpenAI API key is required and currently missing.")

        llm = self._get_llm()
        user_prompt = build_user_prompt(
            headline,
            snippet,
            user_prompt_template=self._user_prompt_template,
        )
        response = None
        raw_content: Any = ""
        payload: dict[str, Any] = {}
        try:
            from langchain_core.messages import HumanMessage, SystemMessage

            response = llm.invoke(
                [
                    SystemMessage(content=self._system_prompt),
                    HumanMessage(content=user_prompt),
                ]
            )
            raw_content = getattr(response, "content", "")
            payload = _normalize_payload_for_validation(_extract_json_payload(raw_content))
            return EventClassification.model_validate(payload)
        except json.JSONDecodeError as exc:
            details = _build_json_error_details(response=response, raw_content=raw_content)
            raise ValueError(f"LLM returned invalid JSON: {exc}. {details}") from exc
        except ValidationError as exc:
            raise ValueError(
                f"LLM returned schema-invalid payload: {exc}. "
                f"payload_preview={_preview_payload(payload)}"
            ) from exc
        except Exception as exc:
            raise RuntimeError(f"Classification failed: {exc}") from exc
