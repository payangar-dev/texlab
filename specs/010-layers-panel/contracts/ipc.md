# IPC Contracts: Layers Panel

**Feature**: 010-layers-panel | **Date**: 2026-04-01

All commands return `Result<EditorStateDto, AppError>` unless noted. All emit the `"state-changed"` Tauri event on success.

## New Command

### `duplicate_layer`

Duplicates the specified layer, inserting the copy directly above the original.

**Input**:
```typescript
invoke("duplicate_layer", { layerId: string })
```

| Param | Type | Description |
|-------|------|-------------|
| layerId | string | 32-char hex ID of the layer to duplicate |

**Output**: `EditorStateDto` with the new duplicate in the layers array, set as `activeLayerId`.

**Behavior**:
1. Parse `layerId` to `LayerId`.
2. Call `EditorService::duplicate_layer(source_id, new_id)`.
3. Set `active_layer_id` to the new duplicate's ID.
4. Emit `"state-changed"`.

**Errors**:
- Layer not found (invalid ID).

**Undo**: Recorded as `OperationType::LayerAdd`. Undo removes the duplicate.

---

## Modified Commands

### `add_layer` (behavior change)

Previously appended new layer to the top of the stack. Now inserts above the active layer.

**Input** (unchanged):
```typescript
invoke("add_layer", { name: string })
```

**Behavior change**:
- If there is an active layer: inserts new layer at `active_layer_index + 1`.
- If no active layer (no texture or empty stack): appends to top (unchanged).

### `remove_layer` (guard added)

**New guard**: Rejects removal when only 1 layer remains.

**New error**: `"Cannot delete the last layer"` (AppError::Internal).

---

## Modified DTO

### `LayerInfoDto` (field added)

```typescript
interface LayerInfoDto {
  id: string;
  name: string;
  opacity: number;
  blendMode: BlendMode;
  visible: boolean;
  locked: boolean;
  thumbnail: number[];  // NEW: raw RGBA bytes, length = width * height * 4
}
```

The `thumbnail` contains the layer's raw pixel data. Width and height are taken from `EditorStateDto.texture.width` and `EditorStateDto.texture.height` (all layers share texture dimensions).

---

## Existing Commands (unchanged)

These commands already exist and require no modifications:

| Command | Input | Notes |
|---------|-------|-------|
| `move_layer` | `{ fromIndex: number, toIndex: number }` | Index-based reorder |
| `set_layer_visibility` | `{ layerId: string, visible: boolean }` | Toggle eye icon |
| `set_layer_blend_mode` | `{ layerId: string, blendMode: string }` | Dropdown change |
| `set_layer_name` | `{ layerId: string, name: string }` | Inline rename confirm |
| `set_layer_opacity` | `{ layerId: string, opacity: number }` | Display only in this feature (no editor) |
| `set_layer_locked` | `{ layerId: string, locked: boolean }` | Not in scope for panel UI |
| `get_editor_state` | -- | Full state query |

---

## Events

| Event | Direction | Payload | Notes |
|-------|-----------|---------|-------|
| `"state-changed"` | Rust -> Frontend | None | Emitted by all mutation commands. Frontend calls `refreshState()` to re-fetch `EditorStateDto`. |
