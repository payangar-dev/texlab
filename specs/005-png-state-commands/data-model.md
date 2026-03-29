# Data Model: PNG I/O + AppState + Tauri Commands

**Feature Branch**: `005-png-state-commands`
**Date**: 2026-03-29

## Existing Domain Entities (unchanged)

These entities already exist in `src-tauri/src/domain/` and are NOT modified by this feature. Listed here for reference as DTOs map from them.

### Color
- `r: u8`, `g: u8`, `b: u8`, `a: u8`
- Immutable value object, validated at construction

### PixelBuffer
- `width: u32`, `height: u32`, `data: Vec<u8>` (RGBA, row-major)
- `get_pixel(x, y) -> Color`, `set_pixel(x, y, color)`

### Layer
- `id: LayerId` (u128), `name: String`
- `buffer: PixelBuffer`, `opacity: f32`, `blend_mode: BlendMode`
- `visible: bool`, `locked: bool`

### LayerStack
- `layers: Vec<Layer>` (bottom to top)
- `composite(w, h) -> PixelBuffer`

### Texture
- `namespace: String`, `path: String`
- `width: u32`, `height: u32`
- `layer_stack: LayerStack`, `dirty: bool`

### BlendMode (enum)
- `Normal`, `Multiply`, `Screen`, `Overlay`

### Tool (trait)
- Implementations: `BrushTool`, `EraserTool`, `FillTool`, `ColorPickerTool`, `LineTool`, `SelectionTool`
- Lifecycle: `on_press`, `on_drag`, `on_release`

### ToolResult (enum)
- `PixelsModified`, `ColorPicked(Color)`, `SelectionChanged(Option<Selection>)`, `NoOp`

### EditorService (use_cases)
- `texture: Texture`, `undo_manager: UndoManager`
- Methods: `apply_tool_press/drag/release`, `undo`, `redo`, layer CRUD, property setters

---

## New Types: AppState

### AppState (`state.rs`)

```rust
pub struct AppState {
    pub editor: Option<EditorService>,
    pub active_tool: Option<Box<dyn Tool>>,
    pub active_layer_id: Option<LayerId>,
}
```

- `editor: None` = no texture open (initial state)
- `editor: Some(EditorService)` = texture open and ready for editing
- `active_tool`: persists the tool instance across a press→drag→release stroke cycle. Created on `tool_press`, reused on `tool_drag`/`tool_release`, cleared after `tool_release`. Required because `BrushTool`, `LineTool`, and `SelectionTool` are stateful (track `last_pos`/`start_pos` between calls).
- `active_layer_id`: tracks which layer the user is working on. Set to the first layer on open/create, updated by the frontend via tool commands. Stored in Rust (not frontend-only) so MCP agents can also query it.
- Wrapped in `Mutex<AppState>` and managed by Tauri

**State transitions:**
- App launch → `AppState { editor: None, active_tool: None, active_layer_id: None }`
- `open_texture` / `create_texture` → `editor: Some(...)`, `active_layer_id: Some(first_layer_id)`, `active_tool: None`
- `tool_press` → `active_tool: Some(Box::new(SelectedTool))`
- `tool_release` → `active_tool: None`
- `save_texture` → editor remains, `texture.dirty` set to false
- `open_texture` while dirty → **refused** (error returned)
- `open_texture` while clean → old editor replaced, `active_tool: None`

---

## New Types: Infrastructure Adapters

### PngReader (`infrastructure/png_reader.rs`)

Implements `domain::ports::ImageReader`.

```rust
pub struct PngReader;

impl ImageReader for PngReader {
    fn read(&self, path: &str) -> Result<PixelBuffer, DomainError>;
}
```

- Uses `image::open(path)?.to_rgba8().into_raw()` internally
- Maps `image::ImageError` → `DomainError::IoError { reason }`
- Handles all PNG color types (RGB, Grayscale, Indexed → RGBA8 normalization)

### PngWriter (`infrastructure/png_writer.rs`)

Implements `domain::ports::ImageWriter`.

```rust
pub struct PngWriter;

impl ImageWriter for PngWriter {
    fn write(&self, path: &str, buffer: &PixelBuffer) -> Result<(), DomainError>;
}
```

- Uses `ImageBuffer::from_raw(w, h, data).save(path)` internally
- Maps `image::ImageError` → `DomainError::IoError { reason }`

---

## New Types: DTOs (`commands/dto.rs`)

All DTOs derive `serde::Serialize` and use `#[serde(rename_all = "camelCase")]`.

### EditorStateDto

Full state snapshot returned after mutations and by `get_editor_state`.

```rust
pub struct EditorStateDto {
    pub texture: Option<TextureMetadataDto>,
    pub layers: Vec<LayerInfoDto>,
    pub active_layer_id: Option<String>,
    pub can_undo: bool,
    pub can_redo: bool,
}
```

- `texture: None` when no texture is open
- `active_layer_id`: hex string of the layer tracked in `AppState.active_layer_id`. Defaults to the first (bottom) layer on open/create. Updated when the frontend sends tool commands with a different `layerId`.

### TextureMetadataDto

```rust
pub struct TextureMetadataDto {
    pub namespace: String,
    pub path: String,
    pub width: u32,
    pub height: u32,
    pub dirty: bool,
}
```

### LayerInfoDto

Layer metadata without pixel data.

```rust
pub struct LayerInfoDto {
    pub id: String,           // LayerId as hex string
    pub name: String,
    pub opacity: f32,
    pub blend_mode: String,   // "normal", "multiply", "screen", "overlay"
    pub visible: bool,
    pub locked: bool,
}
```

### CompositeDto

Composited pixel data for canvas rendering.

```rust
pub struct CompositeDto {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,        // RGBA bytes, row-major
}
```

### ToolResultDto

Result of a tool operation.

```rust
pub struct ToolResultDto {
    pub result_type: String,          // "pixels_modified", "color_picked", "selection_changed", "no_op"
    pub picked_color: Option<ColorDto>,
    pub selection: Option<SelectionDto>,
    pub composite: Option<CompositeDto>,
}
```

- `composite` is included when `result_type == "pixels_modified"` to avoid a second round-trip

### ColorDto

```rust
pub struct ColorDto {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}
```

### SelectionDto

```rust
pub struct SelectionDto {
    pub left: u32,
    pub top: u32,
    pub right: u32,
    pub bottom: u32,
}
```

---

## DTO Conversion Rules

| Domain Type | DTO | Conversion |
|-------------|-----|------------|
| `&Texture` | `TextureMetadataDto` | `From<&Texture>` |
| `&Layer` | `LayerInfoDto` | `From<&Layer>` |
| `&PixelBuffer` | `CompositeDto` | `From<&PixelBuffer>` |
| `ToolResult` | `ToolResultDto` | Manual (match arms, includes composite when pixels modified) |
| `Color` | `ColorDto` | `From<Color>` |
| `Selection` | `SelectionDto` | `From<&Selection>` |
| `&EditorService` | `EditorStateDto` | Manual (aggregates texture + layers + undo state) |

All conversions are infallible and use owned types (String, Vec<u8>) for Tauri IPC compatibility.

---

## Error Types

### AppError Expansion (`error.rs`)

```rust
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    Internal(String),
}
```

The existing single-variant `AppError` serializes as a plain string. Add `From` impls:

```rust
impl From<DomainError> for AppError {
    fn from(err: DomainError) -> Self {
        AppError::Internal(err.to_string())
    }
}

impl From<image::ImageError> for AppError {
    fn from(err: image::ImageError) -> Self {
        AppError::Internal(err.to_string())
    }
}
```

No new variants needed — the string carries the message. The frontend displays it as-is.

---

## Validation Rules

| Rule | Where Enforced | Error |
|------|---------------|-------|
| Namespace non-empty | `Texture::new()` (domain) | `DomainError::EmptyNamespace` |
| Path non-empty | `Texture::new()` (domain) | `DomainError::EmptyPath` |
| Dimensions > 0 | `Texture::new()` (domain) | `DomainError::InvalidDimensions` |
| Layer name non-empty | `Layer::new()` (domain) | `DomainError::EmptyName` |
| Brush size 1-16 | `BrushSize::new()` (domain) | `DomainError::InvalidBrushSize` |
| No open texture | Commands check `state.editor.is_some()` | `AppError::Internal("no texture open")` |
| Unsaved changes guard | `open_texture` command checks `texture.is_dirty()` | `AppError::Internal("unsaved changes")` |
| File exists (read) | `image::open()` (infra) | `DomainError::IoError` → `AppError` |
| File writable (save) | `img.save()` (infra) | `DomainError::IoError` → `AppError` |

---

## State Transitions

```
[No Texture] --open_texture(path)--> [Texture Open (clean)]
[No Texture] --create_texture(ns, path, w, h)--> [Texture Open (clean)]

[Texture Open (clean)] --any mutation--> [Texture Open (dirty)]
[Texture Open (clean)] --open_texture(path)--> [Texture Open (clean)] (replace)

[Texture Open (dirty)] --save_texture()--> [Texture Open (clean)]
[Texture Open (dirty)] --open_texture(path)--> ERROR "unsaved changes"
[Texture Open (dirty)] --undo all--> [Texture Open (dirty)] (dirty flag stays)
```

Note: The dirty flag is only cleared by `save_texture`. Undo does not clear it (the texture was modified in this session regardless of undo state).
