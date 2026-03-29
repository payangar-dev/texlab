# Quickstart: Undo/Redo System

**Feature**: 004-undo-redo-system
**Scope**: Backend only (domain + use_cases layers)

## What This Feature Adds

A snapshot-based undo/redo system for texture editing. Every user action (draw stroke, layer add/remove/reorder, property change) is recorded as a full-state snapshot. Users can undo up to 100 steps per texture.

## New Files

### Domain Layer (`src-tauri/src/domain/`)

| File | Purpose |
|------|---------|
| `undo.rs` | `LayerSnapshot`, `TextureSnapshot`, `OperationType`, `UndoEntry`, `UndoManager` |

### Use Cases Layer (`src-tauri/src/use_cases/`)

| File | Purpose |
|------|---------|
| `editor_service.rs` | `EditorService` — orchestrates tool operations and layer mutations with undo recording |

## Modified Files

| File | Change |
|------|--------|
| `domain/mod.rs` | Add `pub mod undo;` and re-exports |
| `domain/error.rs` | Add `EmptyHistory` variant to `DomainError` |
| `domain/layer.rs` | Add `restore_from_snapshot()` method (bypasses lock) |
| `domain/layer_stack.rs` | Add `restore_from_snapshots()` method |
| `use_cases/mod.rs` | Add `pub mod editor_service;` |

## Key APIs

### UndoManager

```rust
UndoManager::new(max_depth: usize) -> Self
UndoManager::push(entry: UndoEntry)          // Records operation, clears redo, evicts oldest
UndoManager::can_undo() -> bool
UndoManager::can_redo() -> bool
UndoManager::undo_count() -> usize
UndoManager::redo_count() -> usize
```

### EditorService

```rust
EditorService::new(texture: Texture) -> Self
EditorService::apply_tool_press(tool, layer_id, x, y, color, brush_size) -> Result<ToolResult>
EditorService::apply_tool_drag(tool, layer_id, x, y, color, brush_size) -> Result<ToolResult>
EditorService::apply_tool_release(tool, layer_id, x, y, color, brush_size) -> Result<ToolResult>
EditorService::add_layer(id, name) -> Result<()>
EditorService::remove_layer(id) -> Result<()>
EditorService::move_layer(from, to) -> Result<()>
EditorService::set_layer_property(id, property, value) -> Result<()>
EditorService::undo() -> Result<()>
EditorService::redo() -> Result<()>
EditorService::can_undo() -> bool
EditorService::can_redo() -> bool
EditorService::texture() -> &Texture
```

## Testing Strategy

All tests are unit tests with in-memory data (no I/O). Test structure:

- **UndoManager tests**: Stack behavior, max depth eviction, fork on new op, empty history edge cases
- **Snapshot tests**: Round-trip (create snapshot → restore → compare), multi-layer snapshots
- **EditorService tests**: Full integration of tool ops + undo/redo, layer ops + undo/redo, mixed operation sequences

## Quick Verification

```bash
cd src-tauri
cargo test --lib domain::undo
cargo test --lib use_cases::editor_service
```
