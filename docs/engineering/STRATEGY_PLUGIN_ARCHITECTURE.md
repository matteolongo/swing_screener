# Strategy Plugin Architecture

> Status: current.  
> Last reviewed: 2026-03-07.

This document describes the current strategy system after the YAML plugin refactor.

## Summary

The strategy is now:

- file-driven
- plugin-based
- read-only in the UI
- validated through a capability graph

The source of truth is no longer an editable strategy payload stored through CRUD APIs. The source of truth is:

- root strategy config: `/config/strategy.yaml`
- plugin manifests and defaults: `/src/swing_screener/strategy/plugins/<plugin_id>/`

## Directory Layout

Root config:

- `/config/strategy.yaml`

Plugin system:

- `/src/swing_screener/strategy/plugin_system.py`
- `/src/swing_screener/strategy/plugins/<plugin_id>/plugin.yaml`
- `/src/swing_screener/strategy/plugins/<plugin_id>/defaults.yaml`

Runtime API models:

- `/api/models/strategy_runtime.py`

Read-only API surface:

- `GET /api/strategy/config`
- `GET /api/strategy/plugins`
- `GET /api/strategy/validation`

## Merge Model

Strategy resolution works in this order:

1. discover all plugin folders
2. load each plugin `plugin.yaml`
3. load each plugin `defaults.yaml`
4. load `/config/strategy.yaml`
5. apply root overrides on top of plugin defaults
6. validate the final config and capability graph
7. expose resolved state through the API

The root YAML can:

- enable or disable a plugin
- override plugin config values

The root YAML cannot:

- redefine the plugin contract
- invent unknown fields without validation errors

## Plugin Contract

Each plugin declares:

- `id`
- `category`
- `phase`
- `display_name`
- `description`
- `defaults_file`
- `config_schema`
- `docs`
- `runtime_hooks`
- `provides`
- `requires`
- `modifies`
- `conflicts`

Minimal example:

```yaml
id: volume_confirmation
category: Qualification
phase: qualification
display_name: Volume Confirmation
description: Confirm breakouts using relative volume.
defaults_file: defaults.yaml

provides:
  - volume_breakout_confirmation

requires:
  - breakout_signal

modifies:
  - signal_validation

conflicts: []

runtime_hooks:
  - qualify_candidate
  - augment_recommendation
```

## Capability Graph

The runtime builds an execution graph from:

- plugin phases
- capability requirements
- explicit plugin dependencies
- conflicts

This prevents:

- invalid plugin combinations
- implicit ordering bugs
- silent missing dependencies

Example:

- `breakout_signal` provides `breakout_signal`
- `volume_confirmation` requires `breakout_signal`
- runtime places `breakout_signal` before `volume_confirmation`

The resolved graph is exposed by `GET /api/strategy/config` as:

- `execution_order`
- `graph_edges`

The UI shows this as the read-only execution graph.

## UI Model

The Strategy page is now read-only.

It shows:

- strategy metadata
- resolved plugin values
- whether a value comes from plugin default or root override
- plugin docs
- validation warnings
- execution graph
- plugin capability metadata

It does not:

- edit strategy fields
- save strategy mutations
- create or delete strategies

Those mutation endpoints now return `405`.

## Volume Confirmation

`volume_confirmation` is the first qualification plugin added on top of this architecture.

Default config:

```yaml
enabled: false
config:
  enabled: false
  volume_ma_window: 20
  min_breakout_volume_ratio: 1.5
  apply_to_breakout: true
  apply_to_pullback: false
```

Current behavior:

- applies to `breakout` and `both`
- computes `volume_ratio = today_volume / average_volume`
- if the configured threshold is not met, the breakout is invalidated
- recommendation output includes a dedicated checklist gate and failure reason

## How To Add A New Plugin

1. create `/src/swing_screener/strategy/plugins/<plugin_id>/plugin.yaml`
2. create `/src/swing_screener/strategy/plugins/<plugin_id>/defaults.yaml`
3. declare schema, docs and capabilities
4. wire runtime behavior where the declared `runtime_hooks` are consumed
5. add root overrides in `/config/strategy.yaml` only if needed
6. verify API payload and Strategy page rendering
7. add tests for:
   - discovery
   - validation
   - execution ordering
   - runtime behavior

## Validation Rules

Validation currently checks:

- schema type mismatches
- numeric min/max violations
- unknown root override fields
- missing plugin dependencies
- missing capability providers
- declared conflicts

## Notes

- This system is intentionally repo-internal for now. Plugins are discovered from the repository tree, not from external packages.
- Legacy strategy consumers still receive an adapted runtime payload where needed, but the canonical authoring model is now YAML + plugin manifests.
