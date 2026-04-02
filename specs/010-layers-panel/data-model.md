# Data Model: Layers Panel

**Feature**: 010-layers-panel | **Date**: 2026-04-01

## Domain Entities (existing, extended)

### Layer (`domain/layer.rs`)

Existing entity. Addition: `duplicate()` method.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | LayerId(u128) | Unique, immutable | UUID-based, generated in commands layer |
| name | String | Non-empty | Validated at construction and rename |
| buffer | PixelBuffer | width x height x 4 RGBA bytes | Transparent on creation |
| opacity | f32 | Clamped [0.0, 1.0] | Default 1.0 |
| blend_mode | BlendMode | Normal/Multiply/Screen/Overlay | Default Normal |
| visible | bool | -- | Default true |
| locked | bool | -- | Default false |

**New method**:
```
duplicate(new_id: LayerId) -> Result<Layer, DomainError>
```
Creates a copy with the given ID, name suffixed with " (copy)", all properties cloned, buffer deep-copied.

### LayerStack (`domain/layer_stack.rs`)

Existing entity. Additions: `insert_layer()`, `index_of()`.

**New methods**:
```
insert_layer(index: usize, layer: Layer) -> Result<(), DomainError>
  - Validates index <= len (allows appending at end)
  - Inserts layer at position in the internal Vec

index_of(id: LayerId) -> Option<usize>
  - Returns the position of the layer with the given ID
```

### BlendMode (`domain/blend.rs`)

Existing enum, unchanged.

```
Normal | Multiply | Screen | Overlay
```

## Use Case Operations (existing, extended)

### EditorService (`use_cases/editor_service.rs`)

**New methods**:

```
add_layer_above(id: LayerId, name: &str, above_id: Option<LayerId>) -> Result<(), DomainError>
  - If above_id is Some: finds index, inserts at index + 1
  - If above_id is None: appends to top (same as current add_layer)
  - Records undo entry (OperationType::LayerAdd)

duplicate_layer(source_id: LayerId, new_id: LayerId) -> Result<(), DomainError>
  - Finds source layer, gets its index
  - Calls source.duplicate(new_id)
  - Inserts duplicate at source_index + 1
  - Records undo entry (OperationType::LayerAdd)
```

## DTOs (IPC boundary)

### LayerInfoDto (`commands/dto.rs`)

Extended with thumbnail field.

| Field | Rust Type | TS Type | Notes |
|-------|-----------|---------|-------|
| id | String | string | 32-char hex of u128 |
| name | String | string | Display name |
| opacity | f32 | number | 0.0 to 1.0 |
| blend_mode | String | BlendMode | "normal"/"multiply"/"screen"/"overlay" |
| visible | bool | boolean | Visibility state |
| locked | bool | boolean | Lock state |
| **thumbnail** | **Vec\<u8\>** | **number[]** | **Raw RGBA bytes. Width/height from TextureMetadataDto.** |

### EditorStateDto (`commands/dto.rs`)

Unchanged. Already contains `layers: Vec<LayerInfoDto>`, `active_layer_id: Option<String>`.

## State Flow

```
User action (click, drag, keystroke)
  |
  v
React component handler
  |
  v
api/commands.ts (invoke IPC)
  |
  v
Rust commands/ (lock Mutex<AppState>, delegate to EditorService)
  |
  v
EditorService (capture undo snapshot, call domain methods)
  |
  v
Domain (Layer, LayerStack) -- pure logic
  |
  v
EditorService (record undo entry, mark dirty)
  |
  v
Rust commands/ (build EditorStateDto, emit "state-changed" event)
  |
  v
Tauri IPC response -> frontend receives EditorStateDto
  |
  v
editorStore.refreshState() -> Zustand update -> React re-render
```

## Validation Rules

| Rule | Layer | Where Enforced |
|------|-------|----------------|
| Name non-empty | Layer::new, Layer::set_name | Domain |
| Opacity [0.0, 1.0] | Layer::set_opacity | Domain (clamped) |
| Blend mode valid | str_to_blend_mode | Commands/DTO |
| Min 1 layer | remove_layer | Commands (guard before calling EditorService) |
| Layer exists | get_layer/get_layer_mut | Domain (Option/Error) |
| Index in bounds | insert_layer, move_layer | Domain |
