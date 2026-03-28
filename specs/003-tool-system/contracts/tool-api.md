# Contract: Domain Tool API

**Feature Branch**: `003-tool-system`
**Date**: 2026-03-28
**Consumer**: `use_cases/` layer, future Tauri commands, MCP tool handlers

## Public API Surface

This contract defines the Rust public interface exposed by `domain::tools` for consumption by the use case layer.

### Module: `domain::tools`

#### Trait: `Tool`

```rust
pub trait Tool {
    /// Human-readable tool name for identification and display.
    fn name(&self) -> &str;

    /// Called when the user presses on the canvas. Begins a new interaction.
    fn on_press(&mut self, ctx: &mut ToolContext, x: u32, y: u32) -> Result<ToolResult, DomainError>;

    /// Called when the user drags across the canvas during an active interaction.
    fn on_drag(&mut self, ctx: &mut ToolContext, x: u32, y: u32) -> Result<ToolResult, DomainError>;

    /// Called when the user releases. Ends the current interaction.
    fn on_release(&mut self, ctx: &mut ToolContext, x: u32, y: u32) -> Result<ToolResult, DomainError>;
}
```

#### Struct: `ToolContext<'a>`

```rust
pub struct ToolContext<'a> {
    pub buffer: &'a mut PixelBuffer,
    pub color: Color,
    pub brush_size: BrushSize,
}
```

#### Enum: `ToolResult`

```rust
pub enum ToolResult {
    PixelsModified,
    ColorPicked(Color),
    SelectionChanged(Option<Selection>),
    NoOp,
}
```

#### Struct: `BrushSize`

```rust
impl BrushSize {
    pub fn new(size: u8) -> Result<Self, DomainError>;
    pub fn value(self) -> u8;
}
```

### Module: `domain::selection`

#### Struct: `Selection`

```rust
impl Selection {
    pub fn new(x1: u32, y1: u32, x2: u32, y2: u32) -> Self;
    pub fn clip(self, canvas_width: u32, canvas_height: u32) -> Option<Self>;
    pub fn left(&self) -> u32;
    pub fn top(&self) -> u32;
    pub fn right(&self) -> u32;
    pub fn bottom(&self) -> u32;
    pub fn width(&self) -> u32;
    pub fn height(&self) -> u32;
    pub fn contains(&self, x: u32, y: u32) -> bool;
}
```

### Tool Constructors

Each tool implements `Default` for zero-config creation:

```rust
BrushTool::default()      // name: "Brush"
EraserTool::default()     // name: "Eraser"
FillTool::default()       // name: "Fill"
ColorPickerTool::default() // name: "Color Picker"
LineTool::default()       // name: "Line"
SelectionTool::default()  // name: "Selection"
```

## Usage Pattern (for use case layer)

```rust
// 1. Get mutable buffer (checks locked status)
let buffer = layer.buffer_mut()?; // Err(LayerLocked) if locked

// 2. Create context
let mut ctx = ToolContext {
    buffer,
    color: active_color,
    brush_size: BrushSize::new(size)?,
};

// 3. Dispatch tool event
let result = tool.on_press(&mut ctx, x, y)?;

// 4. Interpret result
match result {
    ToolResult::PixelsModified => { /* mark dirty, notify frontend */ }
    ToolResult::ColorPicked(c) => { /* update active color */ }
    ToolResult::SelectionChanged(sel) => { /* update selection state */ }
    ToolResult::NoOp => { /* nothing to do */ }
}
```

## Error Conditions

| Error | When |
|-------|------|
| `DomainError::LayerLocked` | `layer.buffer_mut()` called on a locked layer |
| `DomainError::InvalidBrushSize { size }` | `BrushSize::new()` with size < 1 or > 16 |

Note: Per FR-011, **all** tools silently clip to canvas boundaries — none return `OutOfBounds`. Tools that operate on a single point (ColorPicker, Fill) check bounds before accessing pixels and return `NoOp` if out of bounds. Painting tools (Brush, Eraser, Line) skip out-of-bounds pixels. Selection clips via `Selection::clip()`.
