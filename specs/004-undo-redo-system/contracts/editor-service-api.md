# Use Case API Contract: EditorService

**Layer**: `use_cases/editor_service.rs`
**Consumer**: `commands/` (Tauri IPC) and `mcp/` (MCP server)

## EditorService

Orchestrates all undoable operations on a texture. Single entry point for mutations — callers MUST NOT mutate the texture directly if undo tracking is desired.

```rust
pub struct EditorService {
    // private: texture + undo_manager
}
```

### Construction

| Method | Signature | Notes |
|--------|-----------|-------|
| `new` | `(texture: Texture) -> Self` | Creates service with default history depth (100). |
| `with_max_history` | `(texture: Texture, max_depth: usize) -> Self` | Creates service with custom history depth. |

### Tool Operations

Tool operations follow the press-drag-release lifecycle. A snapshot is taken on `apply_tool_press` and the undo entry is committed on `apply_tool_release`.

| Method | Signature |
|--------|-----------|
| `apply_tool_press` | `(&mut self, tool: &mut dyn Tool, layer_id: LayerId, x: u32, y: u32, color: Color, brush_size: BrushSize) -> Result<ToolResult, DomainError>` |
| `apply_tool_drag` | `(&mut self, tool: &mut dyn Tool, layer_id: LayerId, x: u32, y: u32, color: Color, brush_size: BrushSize) -> Result<ToolResult, DomainError>` |
| `apply_tool_release` | `(&mut self, tool: &mut dyn Tool, layer_id: LayerId, x: u32, y: u32, color: Color, brush_size: BrushSize) -> Result<ToolResult, DomainError>` |

**Snapshot behavior**:
- `apply_tool_press`: Captures pre-operation snapshot. Stores it as pending.
- `apply_tool_drag`: No snapshot action. Applies tool normally.
- `apply_tool_release`: If tool produced any `PixelsModified` during this cycle, commits the pending snapshot as an UndoEntry. Otherwise discards it.
- Non-modifying tools (ColorPicker, Selection) do NOT create undo entries.

### Layer Operations

Each layer operation snapshots before mutation and immediately commits an undo entry.

| Method | Signature |
|--------|-----------|
| `add_layer` | `(&mut self, id: LayerId, name: &str) -> Result<(), DomainError>` |
| `remove_layer` | `(&mut self, id: LayerId) -> Result<(), DomainError>` |
| `move_layer` | `(&mut self, from_index: usize, to_index: usize) -> Result<(), DomainError>` |
| `set_layer_opacity` | `(&mut self, id: LayerId, opacity: f32) -> Result<(), DomainError>` |
| `set_layer_blend_mode` | `(&mut self, id: LayerId, mode: BlendMode) -> Result<(), DomainError>` |
| `set_layer_visibility` | `(&mut self, id: LayerId, visible: bool) -> Result<(), DomainError>` |
| `set_layer_name` | `(&mut self, id: LayerId, name: &str) -> Result<(), DomainError>` |
| `set_layer_locked` | `(&mut self, id: LayerId, locked: bool) -> Result<(), DomainError>` |

### Undo/Redo

| Method | Signature | Behavior |
|--------|-----------|----------|
| `undo` | `(&mut self) -> Result<(), DomainError>` | Restores previous state. Returns `Err(EmptyHistory)` if nothing to undo. |
| `redo` | `(&mut self) -> Result<(), DomainError>` | Re-applies undone operation. Returns `Err(EmptyHistory)` if nothing to redo. |
| `can_undo` | `(&self) -> bool` | Whether undo stack is non-empty. |
| `can_redo` | `(&self) -> bool` | Whether redo stack is non-empty. |

### Read Access

| Method | Signature |
|--------|-----------|
| `texture` | `(&self) -> &Texture` |
| `texture_mut` | `(&mut self) -> &mut Texture` |

**Note**: `texture_mut()` provides direct mutation access WITHOUT undo tracking. Use only for non-undoable operations (e.g., mark_saved). Callers who want undo tracking MUST use the dedicated methods above.
