# Data Model: Fix Undo/Redo System

**Feature**: 035-fix-undo-redo | **Date**: 2026-04-10

## Entity Changes

### Modified: `UndoEntry` (domain/undo.rs)

The `UndoEntry` struct replaces its `TextureSnapshot` field with a discriminated `UndoPayload`.

```rust
pub struct UndoEntry {
    operation: OperationType,
    payload: UndoPayload,  // was: snapshot: TextureSnapshot
}
```

**Invariant**: The `payload` variant must be consistent with the `operation` type:
- `OperationType::Draw` → `UndoPayload::SingleLayer`
- `OperationType::LayerPropertyChange` → `UndoPayload::Property`
- `OperationType::LayerAdd | LayerRemove | LayerReorder` → `UndoPayload::FullStack`

---

### New: `UndoPayload` (domain/undo.rs)

Discriminated union representing the minimum data needed to reverse an operation.

```rust
pub enum UndoPayload {
    /// Full pixel snapshot of a single affected layer (for draw operations).
    /// Constitution Principle VI: "full-layer snapshots, not diff-based."
    SingleLayer(LayerSnapshot),

    /// Full layer stack snapshot (for structural changes: add, remove, reorder).
    /// Captures all layers to enable symmetric undo/redo swap.
    FullStack(TextureSnapshot),

    /// Metadata-only snapshot for a single layer property change.
    /// No pixel data — only the old value of the changed property.
    Property {
        layer_id: LayerId,
        change: PropertyChange,
    },
}
```

**Validation rules**:
- `SingleLayer`: The `LayerSnapshot.id` must correspond to a layer that existed when the entry was created. On restore, the layer must still exist (structural changes would have their own entries).
- `FullStack`: The snapshot must contain at least one `LayerSnapshot` (textures always have >= 1 layer for structural operations that modify the count).
- `Property`: The `layer_id` must be valid. The `PropertyChange` variant must match the property that was actually changed.

---

### New: `PropertyChange` (domain/undo.rs)

Enum representing the old value of a single layer property.

```rust
pub enum PropertyChange {
    Opacity(f32),
    BlendMode(BlendMode),
    Visibility(bool),
    Name(String),
    Locked(bool),
}
```

**Validation rules**:
- `Opacity`: Must be in range [0.0, 1.0] (enforced by `Layer::set_opacity` clamp)
- `BlendMode`: Must be a valid `BlendMode` variant
- `Name`: Must be non-empty (enforced by `Layer::set_name`)

---

### Unchanged: `LayerSnapshot` (domain/undo.rs)

No structural changes. Already captures a single layer's complete state (id, name, pixel data, opacity, blend mode, visibility, locked). Used by `UndoPayload::SingleLayer`.

---

### Unchanged: `TextureSnapshot` (domain/undo.rs)

No structural changes. Captures all layers via `Vec<LayerSnapshot>`. Used by `UndoPayload::FullStack`.

---

### Unchanged: `OperationType` (domain/undo.rs)

```rust
pub enum OperationType {
    Draw,
    LayerAdd,
    LayerRemove,
    LayerReorder,
    LayerPropertyChange,
}
```

No changes. The five operation types remain the same.

---

### Unchanged: `UndoManager` (domain/undo.rs)

No structural changes to `UndoManager`. It manages `VecDeque<UndoEntry>` (undo stack) and `Vec<UndoEntry>` (redo stack) with bounded depth. The internal logic (push, pop, clear, max_depth eviction) is payload-agnostic.

---

### Modified: `EditorService` (use_cases/editor_service.rs)

**New field**:
```rust
pub struct EditorService {
    texture: Texture,
    undo_manager: UndoManager,
    pending_snapshot: Option<TextureSnapshot>,       // CHANGED TYPE — see below
    pixels_modified_in_cycle: bool,
    pending_draw_layer_id: Option<LayerId>,           // NEW
}
```

**`pending_snapshot` type change**: Stays as `Option<TextureSnapshot>` during the press phase (we still capture a full snapshot at press time for safety). At release time, the snapshot is narrowed to `SingleLayer` by extracting only the affected layer's data.

**`pending_draw_layer_id`**: Tracks which layer the current stroke is targeting. Set on `apply_tool_press`, cleared on `apply_tool_release`. Used during mid-stroke finalization to extract the correct layer from the pending snapshot.

---

## State Transitions

### Stroke Lifecycle (press → drag → release)

```
State: idle
  pending_snapshot = None
  pending_draw_layer_id = None
  pixels_modified_in_cycle = false

→ apply_tool_press(layer_id)
  pending_snapshot = Some(TextureSnapshot::capture(layer_stack))
  pending_draw_layer_id = Some(layer_id)
  pixels_modified_in_cycle = false

State: active_stroke
  pending_snapshot = Some(...)
  pending_draw_layer_id = Some(id)

→ apply_tool_drag(layer_id)
  pixels_modified_in_cycle |= (result == PixelsModified)

→ apply_tool_release(layer_id)
  if pixels_modified_in_cycle:
    extract affected layer from pending_snapshot → SingleLayer payload
    push UndoEntry(Draw, SingleLayer(layer_snapshot))
  pending_snapshot = None
  pending_draw_layer_id = None
  pixels_modified_in_cycle = false

State: idle (back to start)
```

### Mid-Stroke Undo

```
State: active_stroke
  pending_snapshot = Some(...)
  pending_draw_layer_id = Some(id)
  pixels_modified_in_cycle = true/false

→ undo() called
  if pending_snapshot.is_some():
    FINALIZE:
      if pixels_modified_in_cycle:
        extract affected layer → push UndoEntry(Draw, SingleLayer(...))
      clear pending_snapshot, pending_draw_layer_id, pixels_modified_in_cycle
    PROCEED: normal undo (pop top of undo stack)
  else:
    normal undo

State: idle
  (active_tool cleared in command layer)
```

### Undo/Redo Restore (per payload variant)

```
undo/redo:
  entry = pop from source stack
  
  match entry.payload:
    SingleLayer(old_layer):
      current_layer = snapshot current state of layer[old_layer.id]
      restore layer[old_layer.id] from old_layer
      push UndoEntry(op, SingleLayer(current_layer)) to target stack
      
    FullStack(old_texture):
      current_texture = snapshot all layers
      restore layer_stack from old_texture
      push UndoEntry(op, FullStack(current_texture)) to target stack
      
    Property { layer_id, change: old_value }:
      current_value = read current property from layer[layer_id]
      set property on layer[layer_id] to old_value
      push UndoEntry(op, Property { layer_id, change: current_value }) to target stack
```

## Relationships

```
UndoManager
  ├── undo_stack: VecDeque<UndoEntry>
  └── redo_stack: Vec<UndoEntry>

UndoEntry
  ├── operation: OperationType
  └── payload: UndoPayload
       ├── SingleLayer(LayerSnapshot)
       ├── FullStack(TextureSnapshot)
       │    └── layers: Vec<LayerSnapshot>
       └── Property { layer_id: LayerId, change: PropertyChange }

EditorService
  ├── texture: Texture
  ├── undo_manager: UndoManager
  ├── pending_snapshot: Option<TextureSnapshot>
  ├── pending_draw_layer_id: Option<LayerId>
  └── pixels_modified_in_cycle: bool
```
