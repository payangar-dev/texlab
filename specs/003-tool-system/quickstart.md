# Quickstart: Tool System

**Feature Branch**: `003-tool-system`

## What this feature adds

Six drawing tools in the domain layer: Brush, Eraser, Fill, Color Picker, Line, and Selection. All tools share a unified press-drag-release interaction model and operate on `PixelBuffer` through a `ToolContext`.

## File layout

```
src-tauri/src/domain/
├── mod.rs              # Updated: add pub mod selection, pub mod tools
├── error.rs            # Updated: add InvalidBrushSize variant
├── layer.rs            # Updated: add buffer_mut() method
├── selection.rs        # NEW: Selection value object
└── tools/
    ├── mod.rs          # NEW: Tool trait, ToolContext, ToolResult, BrushSize, bresenham_line, re-exports
    ├── brush.rs        # NEW: BrushTool
    ├── eraser.rs       # NEW: EraserTool
    ├── fill.rs         # NEW: FillTool
    ├── color_picker.rs # NEW: ColorPickerTool
    ├── line.rs         # NEW: LineTool
    └── selection_tool.rs # NEW: SelectionTool
```

## Key types

```rust
use crate::domain::tools::{Tool, ToolContext, ToolResult, BrushSize};
use crate::domain::tools::{BrushTool, EraserTool, FillTool, ColorPickerTool, LineTool, SelectionTool};
use crate::domain::selection::Selection;
```

## How to use a tool

```rust
// Create the tool
let mut brush = BrushTool::default();

// Get mutable buffer access (locked guard)
let buffer = layer.buffer_mut()?;

// Build context
let mut ctx = ToolContext {
    buffer,
    color: Color::new(255, 0, 0, 255),
    brush_size: BrushSize::new(3)?,
};

// Simulate press → drag → release
brush.on_press(&mut ctx, 5, 5)?;
brush.on_drag(&mut ctx, 6, 6)?;
brush.on_release(&mut ctx, 7, 7)?;
```

## How to run tests

```bash
cd src-tauri
cargo test --lib domain::tools
cargo test --lib domain::selection
```

## Dependencies

- **External**: None (domain layer, std only)
- **Internal**: `PixelBuffer`, `Color`, `Layer`, `DomainError` from existing domain
