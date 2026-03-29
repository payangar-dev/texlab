# Domain API Contract: Undo/Redo

**Layer**: `domain/undo.rs`
**Consumer**: `use_cases/editor_service.rs`

## Types

### LayerSnapshot

```rust
pub struct LayerSnapshot {
    id: LayerId,
    name: String,
    data: Vec<u8>,       // Raw RGBA
    width: u32,
    height: u32,
    opacity: f32,
    blend_mode: BlendMode,
    visible: bool,
    locked: bool,
}
```

- Created via `LayerSnapshot::from_layer(layer: &Layer) -> Self`
- Consumed by `Layer::restore_from_snapshot(&mut self, snapshot: LayerSnapshot)` (bypasses lock, replaces buffer + all properties)

### TextureSnapshot

```rust
pub struct TextureSnapshot {
    layers: Vec<LayerSnapshot>,
}
```

- Created via `TextureSnapshot::capture(layer_stack: &LayerStack) -> Self`
- Consumed by `LayerStack::restore_from_snapshots(&mut self, snapshot: TextureSnapshot) -> Result<(), DomainError>` (replaces all layers from snapshot data)

### OperationType

```rust
pub enum OperationType {
    Draw,
    LayerAdd,
    LayerRemove,
    LayerReorder,
    LayerPropertyChange,
}
```

### UndoEntry

```rust
pub struct UndoEntry {
    operation: OperationType,
    snapshot: TextureSnapshot,
}
```

- Created via `UndoEntry::new(operation: OperationType, snapshot: TextureSnapshot) -> Self`
- Accessors: `operation() -> &OperationType`, `snapshot(self) -> TextureSnapshot`

### UndoManager

```rust
pub struct UndoManager {
    // private fields
}
```

**Public API**:

| Method | Signature | Behavior |
|--------|-----------|----------|
| `new` | `(max_depth: usize) -> Self` | Creates manager with given capacity. Panics if `max_depth == 0`. |
| `push` | `(&mut self, entry: UndoEntry)` | Pushes entry, clears redo stack, evicts oldest if at capacity. |
| `pop_undo` | `(&mut self) -> Option<UndoEntry>` | Pops most recent undo entry. Returns `None` if empty. |
| `push_redo` | `(&mut self, entry: UndoEntry)` | Pushes entry to redo stack. |
| `pop_redo` | `(&mut self) -> Option<UndoEntry>` | Pops most recent redo entry. Returns `None` if empty. |
| `can_undo` | `(&self) -> bool` | `!undo_stack.is_empty()` |
| `can_redo` | `(&self) -> bool` | `!redo_stack.is_empty()` |
| `undo_count` | `(&self) -> usize` | Number of entries in undo stack. |
| `redo_count` | `(&self) -> usize` | Number of entries in redo stack. |
| `clear` | `(&mut self)` | Clears both stacks. |

## Error Additions

```rust
// Added to DomainError
EmptyHistory,
```

Returned when `undo()` or `redo()` is called on an empty stack (at the EditorService level).
