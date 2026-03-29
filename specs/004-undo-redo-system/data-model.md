# Data Model: Undo/Redo System

**Feature**: 004-undo-redo-system
**Date**: 2026-03-29

## Entities

### LayerSnapshot

Immutable capture of a single layer's complete state at a point in time.

```
LayerSnapshot
├── id: LayerId                  # Original layer ID
├── name: String                 # Layer name at snapshot time
├── data: Vec<u8>                # Raw RGBA pixel data (clone of PixelBuffer.data)
├── width: u32                   # Buffer width
├── height: u32                  # Buffer height
├── opacity: f32                 # 0.0–1.0
├── blend_mode: BlendMode        # Normal/Multiply/Screen/Overlay
├── visible: bool                # Visibility state
└── locked: bool                 # Lock state
```

**Validation rules**: None at construction — all fields are already validated at their source (LayerId, PixelBuffer dimensions, etc.). This is a data transfer snapshot, not a domain entity with invariants.

**Relationships**: Created from a `Layer` reference. Used to restore a `Layer` to a prior state.

### TextureSnapshot

Immutable capture of the entire texture's layer stack state.

```
TextureSnapshot
├── layers: Vec<LayerSnapshot>   # All layers in stack order (bottom to top)
```

**Validation rules**: None — mirrors LayerStack structure at capture time.

**Relationships**: Created from a `LayerStack` reference. Used to restore a complete `LayerStack`.

### OperationType

Enum describing what kind of user action was performed. Used for display/debugging, not for undo logic (snapshots are self-sufficient).

```
OperationType
├── Draw                         # Brush, eraser, fill, line tool stroke
├── LayerAdd                     # New layer added
├── LayerRemove                  # Layer removed
├── LayerReorder                 # Layer order changed
└── LayerPropertyChange          # Opacity, blend mode, visibility, name, locked
```

### UndoEntry

A single undoable step in the history. Captures the state *before* the operation was applied.

```
UndoEntry
├── operation: OperationType     # What was done
└── snapshot: TextureSnapshot    # Full layer stack state before the operation
```

**Invariant**: The snapshot represents the state to restore when this entry is undone.

### UndoManager

Per-texture history manager. Owns the undo and redo stacks.

```
UndoManager
├── undo_stack: VecDeque<UndoEntry>   # History of past operations (most recent at back)
├── redo_stack: Vec<UndoEntry>         # Future operations after undo (most recent at back)
└── max_depth: usize                   # Maximum undo stack size (default: 100)
```

**Validation rules**:
- `max_depth` must be ≥ 1
- `undo_stack.len()` ≤ `max_depth` (enforced on push)

**State transitions**:

| Action | undo_stack | redo_stack |
|--------|-----------|------------|
| New operation | Push entry, evict oldest if full | **Clear entirely** (fork behavior) |
| Undo | Pop from back → restore snapshot | Push current state as entry |
| Redo | Push current state as entry | Pop from back → restore snapshot |

### EditorService (Use Case)

Orchestrates user operations, recording undo entries before applying changes.

```
EditorService
├── texture: Texture              # The document being edited
└── undo_manager: UndoManager     # History for this texture
```

**Responsibilities**:
- Snapshot before applying any undoable operation
- Delegate to domain (tools, layer operations) for the actual mutation
- Push the pre-operation snapshot to UndoManager
- Provide undo/redo execution (swap current state with snapshot)
- Report undo/redo availability (can_undo, can_redo)

## Key Operations

### Recording an Operation

```
1. Capture TextureSnapshot from current LayerStack
2. Apply the domain mutation (tool stroke, layer op, property change)
3. Create UndoEntry(operation_type, snapshot)
4. Push entry to UndoManager (clears redo stack, evicts oldest if at capacity)
```

### Performing Undo

```
1. Check undo_stack is non-empty
2. Capture current state as TextureSnapshot
3. Pop UndoEntry from undo_stack
4. Create redo entry with current state + same operation type
5. Push redo entry to redo_stack
6. Restore LayerStack from the popped entry's snapshot
```

### Performing Redo

```
1. Check redo_stack is non-empty
2. Capture current state as TextureSnapshot
3. Pop UndoEntry from redo_stack
4. Create undo entry with current state + same operation type
5. Push undo entry to undo_stack
6. Restore LayerStack from the popped entry's snapshot
```

### Restoring from Snapshot

Restoring a TextureSnapshot to a LayerStack replaces all layers entirely — bypassing lock guards. This is a wholesale state replacement, not a series of individual mutations.

```
1. Clear all existing layers from LayerStack
2. For each LayerSnapshot in the TextureSnapshot (in order):
   a. Create new Layer with snapshot's ID, name, dimensions
   b. Copy pixel data directly into Layer's PixelBuffer (bypass lock)
   c. Set opacity, blend_mode, visible, locked from snapshot
   d. Add layer to LayerStack
```

## Memory Budget

| Texture Size | Layers | Snapshot Size | 100 Snapshots |
|-------------|--------|---------------|---------------|
| 16×16       | 1      | ~1 KB         | ~100 KB       |
| 16×16       | 5      | ~5 KB         | ~500 KB       |
| 32×32       | 5      | ~20 KB        | ~2 MB         |
| 64×64       | 5      | ~80 KB        | ~8 MB         |
| 64×64       | 10     | ~160 KB       | ~16 MB        |

All within acceptable bounds for a desktop application.
