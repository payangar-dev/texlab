# Data Model: Tool System

**Feature Branch**: `003-tool-system`
**Date**: 2026-03-28

## Entities

### BrushSize (Value Object)

Validated brush size for painting and erasing tools. Invalid values are unrepresentable.

| Field | Type | Constraints |
|-------|------|-------------|
| `value` | `u8` | 1 ≤ value ≤ 16 |

**Construction**: `BrushSize::new(size: u8) -> Result<Self, DomainError>` — rejects 0 and >16.

**Derived traits**: `Clone, Copy, Debug, PartialEq, Eq`

**Constant**: `BrushSize::DEFAULT` = 1

---

### Selection (Value Object)

A rectangular region defined by its normalized bounding coordinates. Invariant: `left ≤ right` and `top ≤ bottom`.

| Field | Type | Constraints |
|-------|------|-------------|
| `left` | `u32` | left ≤ right |
| `top` | `u32` | top ≤ bottom |
| `right` | `u32` | inclusive bound |
| `bottom` | `u32` | inclusive bound |

**Construction**: `Selection::new(x1: u32, y1: u32, x2: u32, y2: u32) -> Self` — normalizes coordinates so (left, top) is always the min corner.

**Methods**:
- `left()`, `top()`, `right()`, `bottom()` — accessors
- `width() -> u32` — `right - left + 1`
- `height() -> u32` — `bottom - top + 1`
- `contains(x: u32, y: u32) -> bool` — point-in-rect test
- `clip(canvas_width: u32, canvas_height: u32) -> Option<Self>` — clips to canvas bounds, returns `None` if fully outside

**Derived traits**: `Clone, Copy, Debug, PartialEq, Eq`

---

### ToolContext (Transient Context)

Parameters available to a tool during an interaction. Created per interaction, not persisted.

| Field | Type | Description |
|-------|------|-------------|
| `buffer` | `&'a mut PixelBuffer` | Target layer's pixel buffer (already lock-checked) |
| `color` | `Color` | Currently active color |
| `brush_size` | `BrushSize` | Current brush size setting |

**Lifetime**: `'a` tied to the mutable borrow of the Layer's PixelBuffer. Lives for the duration of one tool interaction (press-drag-release).

---

### ToolResult (Enum)

Outcome of a tool operation. One variant per distinct effect type.

| Variant | Payload | Meaning |
|---------|---------|---------|
| `PixelsModified` | — | The tool wrote pixels to the buffer |
| `ColorPicked(Color)` | `Color` | The tool sampled a color from the buffer |
| `SelectionChanged(Option<Selection>)` | `Option<Selection>` | Selection was set or cleared (`None`) |
| `NoOp` | — | No effect (e.g., fill with same color, line drag) |

**Derived traits**: `Clone, Debug, PartialEq`

---

### Tool (Trait)

The unified interaction contract for all drawing instruments.

```rust
pub trait Tool {
    fn name(&self) -> &str;
    fn on_press(&mut self, ctx: &mut ToolContext, x: u32, y: u32) -> Result<ToolResult, DomainError>;
    fn on_drag(&mut self, ctx: &mut ToolContext, x: u32, y: u32) -> Result<ToolResult, DomainError>;
    fn on_release(&mut self, ctx: &mut ToolContext, x: u32, y: u32) -> Result<ToolResult, DomainError>;
}
```

Tools hold interaction state in `&mut self` (e.g., last position for brush, start position for line). State resets at `on_press`.

---

### BrushTool (Entity)

| Field | Type | Description |
|-------|------|-------------|
| `last_pos` | `Option<(u32, u32)>` | Previous position for drag interpolation |

**Behavior**:
- `on_press`: stamps N×N square at (x,y), stores position → `PixelsModified`
- `on_drag`: interpolates from `last_pos` to (x,y) via Bresenham, stamps at each point → `PixelsModified`
- `on_release`: no-op → `NoOp`

---

### EraserTool (Entity)

| Field | Type | Description |
|-------|------|-------------|
| `last_pos` | `Option<(u32, u32)>` | Previous position for drag interpolation |

**Behavior**: Identical to BrushTool but uses `Color::TRANSPARENT` instead of the context color.

---

### FillTool (Entity)

| Field | Type | Description |
|-------|------|-------------|
| (none) | — | Stateless |

**Behavior**:
- `on_press`: if (x,y) is out of bounds → `NoOp` (FR-011 silent clip). Otherwise, read target pixel color, short-circuit if same as fill color → `NoOp` (FR-012). Otherwise BFS flood fill with 4-connectivity → `PixelsModified`.
- `on_drag`: no-op → `NoOp`
- `on_release`: no-op → `NoOp`

---

### ColorPickerTool (Entity)

| Field | Type | Description |
|-------|------|-------------|
| (none) | — | Stateless |

**Behavior**:
- `on_press`: if (x,y) is out of bounds → `NoOp` (FR-011 silent clip). Otherwise reads pixel at (x,y) → `ColorPicked(color)`.
- `on_drag`: no-op → `NoOp`
- `on_release`: no-op → `NoOp`

---

### LineTool (Entity)

| Field | Type | Description |
|-------|------|-------------|
| `start_pos` | `Option<(u32, u32)>` | Press position (line start) |

**Behavior**:
- `on_press`: stores start position → `NoOp`
- `on_drag`: no-op → `NoOp`
- `on_release`: draws Bresenham line from `start_pos` to (x,y), 1px width → `PixelsModified`

---

### SelectionTool (Entity)

| Field | Type | Description |
|-------|------|-------------|
| `start_pos` | `Option<(u32, u32)>` | Press position (drag origin) |

**Behavior**:
- `on_press`: stores start position → `NoOp`
- `on_drag`: computes selection from `start_pos` to (x,y), clips to canvas → `SelectionChanged(Some(sel))`
- `on_release`: if start == release position → `SelectionChanged(None)` (clear). Otherwise → `SelectionChanged(Some(sel))`

---

## Relationships

```
Layer ──buffer_mut()──► PixelBuffer ◄── ToolContext.buffer
                                          │
                     Tool.on_press/drag/release(ctx, x, y)
                                          │
                                     ToolResult
```

- `Layer::buffer_mut()` (new method) → returns `Result<&mut PixelBuffer, DomainError::LayerLocked>`
- `ToolContext` borrows the `PixelBuffer` for the duration of one interaction
- Tools produce `ToolResult` which the caller (use case layer) interprets

## Shared Utilities

### bresenham_line

```rust
pub fn bresenham_line(x0: i32, y0: i32, x1: i32, y1: i32) -> Vec<(i32, i32)>
```

Shared Bresenham's line algorithm used by:
- `LineTool::on_release` — draw the line pixels
- `BrushTool::on_drag` / `EraserTool::on_drag` — interpolate stroke positions

Returns all integer coordinates on the line from (x0,y0) to (x1,y1), inclusive of both endpoints.

## New Error Variants

| Variant | Fields | Trigger |
|---------|--------|---------|
| `InvalidBrushSize` | `{ size: u8 }` | `BrushSize::new()` with size < 1 or size > 16 |

Added to the existing `DomainError` enum.

## Modifications to Existing Types

### Layer (existing)

**New method**:
```rust
pub fn buffer_mut(&mut self) -> Result<&mut PixelBuffer, DomainError> {
    if self.locked {
        return Err(DomainError::LayerLocked { layer_id: self.id.value() });
    }
    Ok(&mut self.buffer)
}
```

No other changes to existing types.
