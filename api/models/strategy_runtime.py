"""Read-only strategy runtime models for the plugin dashboard."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class StrategyPluginDocSectionModel(BaseModel):
    title: str
    body: str


class StrategyPluginConfigFieldDefinitionModel(BaseModel):
    key: str
    label: str
    description: Optional[str] = None
    type: Optional[str] = None


class StrategyPluginDefinition(BaseModel):
    id: str
    category: str
    display_name: str
    description: str = ""
    enabled_by_default: bool = False
    phase: str = "qualification"
    provides: list[str] = Field(default_factory=list)
    requires: list[str] = Field(default_factory=list)
    modifies: list[str] = Field(default_factory=list)
    conflicts: list[str] = Field(default_factory=list)
    config_fields: list[StrategyPluginConfigFieldDefinitionModel] = Field(default_factory=list)
    read_only_sections: list[StrategyPluginDocSectionModel] = Field(default_factory=list)


class StrategyPluginResolvedValueModel(BaseModel):
    key: str
    label: str
    description: Optional[str] = None
    type: Optional[str] = None
    default_value: object | None = None
    effective_value: object | None = None
    overridden: bool = False
    source: Literal["plugin_default", "root_override"] = "plugin_default"


class StrategyPluginResolvedState(BaseModel):
    id: str
    category: str
    display_name: str
    description: str = ""
    enabled: bool = False
    default_enabled: bool = False
    phase: str = "qualification"
    provides: list[str] = Field(default_factory=list)
    requires: list[str] = Field(default_factory=list)
    modifies: list[str] = Field(default_factory=list)
    conflicts: list[str] = Field(default_factory=list)
    depends_on: list[str] = Field(default_factory=list)
    read_only_sections: list[StrategyPluginDocSectionModel] = Field(default_factory=list)
    values: list[StrategyPluginResolvedValueModel] = Field(default_factory=list)


class StrategyResolvedConfig(BaseModel):
    name: str
    description: Optional[str] = None
    module: str
    config_path: Optional[str] = None
    execution_order: list[str] = Field(default_factory=list)
    graph_edges: dict[str, list[str]] = Field(default_factory=dict)
    plugins: list[StrategyPluginResolvedState] = Field(default_factory=list)
