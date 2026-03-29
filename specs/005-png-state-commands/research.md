# Research: PNG I/O + AppState + Tauri Commands

**Feature Branch**: `005-png-state-commands`
**Date**: 2026-03-29

## 1. PNG I/O with `image` crate ^0.25

### Decision: Use `image` crate with PNG-only features

**Rationale**: The `image` crate is the de-facto standard for image I/O in Rust. It provides high-level APIs for reading/writing PNG with automatic color type conversion (RGB, Grayscale, etc. all normalized to RGBA8).

**Alternatives considered**:
- `png` crate (lower-level, more control but more boilerplate)
- `lodepng` (C binding, unnecessary complexity for our needs)

### Key API Patterns

**Reading PNG to RGBA bytes:**
```rust
let img = image::open(path)?;              // DynamicImage (auto-detects format)
let (width, height) = img.dimensions();
let rgba = img.to_rgba8();                 // Always normalize to RGBA8
let raw_pixels: Vec<u8> = rgba.into_raw(); // Row-major, 4 bytes/pixel
```

**Writing RGBA bytes to PNG:**
```rust
let img: RgbaImage = ImageBuffer::from_raw(width, height, rgba_data.to_vec())
    .ok_or_else(|| /* buffer size mismatch error */)?;
img.save(path)?;
```

**Reading PNG from in-memory bytes (for future .texlab ZIP):**
```rust
let cursor = Cursor::new(png_bytes);
let img = ImageReader::new(BufReader::new(cursor))
    .with_guessed_format()?.decode()?;
let rgba = img.to_rgba8();
```

### Cargo.toml dependency

```toml
image = { version = "0.25", default-features = false, features = ["png"] }
```

Disabling default features avoids compiling decoders for JPEG, GIF, TIFF, BMP, etc.

### Gotchas

1. **Always call `.to_rgba8()`** — `image::open` returns a `DynamicImage` whose internal format depends on the source (RGB, Grayscale, etc.). Normalizing avoids layout mismatches.
2. **`ImageBuffer::from_raw` returns `Option`** — must handle `None` (buffer size mismatch).
3. **v0.25 requires `BufRead + Seek`** for generic readers — `Cursor<Vec<u8>>` satisfies both.
4. **Pixel layout is row-major, top-to-bottom, RGBA** — matches `PixelBuffer`'s existing layout.

### Error mapping

`image::ImageError` has variants: `Decoding`, `Encoding`, `Parameter`, `Limits`, `Unsupported`, `IoError`. Map to `DomainError::IoError { reason }` at the infrastructure boundary.

---

## 2. Tauri v2 Command Patterns

### Decision: Sync commands for CPU-bound, async for file I/O

**Rationale**: All pixel/layer/tool/undo operations are pure CPU work (sub-millisecond for 16x16-128x128 textures). Async overhead is unnecessary. Only file read/write commands need async to avoid blocking the main thread.

**Alternatives considered**:
- All async with `tokio::sync::Mutex` — unnecessary complexity, risk of holding locks across await points
- All sync — would block main thread during file I/O (noticeable for larger textures)

### State injection pattern

```rust
#[tauri::command]
fn undo(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
) -> Result<CompositeDto, AppError> {
    let mut state = state.lock().unwrap();
    state.editor.undo()?;
    let composite = state.editor.texture().composite();
    Ok(CompositeDto::from(composite))
}
```

- `State<'_, Mutex<AppState>>` and `AppHandle` are auto-injected (invisible to JS caller)
- Lock briefly, do work, release — no lock held across await points
- Return DTOs, not domain types

### Async I/O pattern (for open/save)

```rust
#[tauri::command]
async fn open_texture(
    state: State<'_, Mutex<AppState>>,
    path: String,
) -> Result<EditorStateDto, AppError> {
    // 1. Read file outside the lock (async I/O)
    let (width, height, pixels) = read_png(&path).await?;

    // 2. Lock briefly to update state
    let mut state = state.lock().unwrap();
    // ... create texture, set up editor
    Ok(EditorStateDto::from(&state))
}
```

### Error bridging

```rust
impl From<DomainError> for AppError {
    fn from(err: DomainError) -> Self {
        AppError::Internal(err.to_string())
    }
}
```

Domain stays serde-free. `AppError` serializes as a string for the frontend.

---

## 3. File Dialogs

### Decision: Frontend-driven dialogs via `@tauri-apps/plugin-dialog`

**Rationale**: Aligns with Clean Architecture — UI concerns (file picking) stay in the frontend. The frontend picks a path, then passes it to a Rust command. This keeps Rust commands pure (path in, result out).

**Alternatives considered**:
- Rust-side dialogs via `DialogExt` — mixes UI concerns into backend commands
- Raw file path input — poor UX, requires user to type paths manually

### Setup

**Rust**: `tauri-plugin-dialog = "2"` in `Cargo.toml`, register via `.plugin(tauri_plugin_dialog::init())`
**Frontend**: `@tauri-apps/plugin-dialog` npm package
**Capabilities**: Add `"dialog:default"` to `src-tauri/capabilities/default.json`

### Frontend usage

```typescript
import { open, save } from '@tauri-apps/plugin-dialog';

const filePath = await open({
  filters: [{ name: 'PNG Images', extensions: ['png'] }],
});
if (filePath) {
  await invoke('open_texture', { path: filePath });
}
```

---

## 4. Event Emission (State Synchronization)

### Decision: `app.emit()` for state-changed notifications

**Rationale**: Constitution principle III (Dual-Access State) requires that MCP mutations notify the frontend. Using Tauri events (`app.emit`) provides a clean, decoupled notification mechanism.

### Pattern

```rust
use tauri::Emitter;

// After any mutation:
app.emit("state-changed", ())?;
```

The frontend listens and re-fetches state:

```typescript
import { listen } from '@tauri-apps/api/event';

await listen('state-changed', () => {
  // Re-fetch editor state from Rust
  refreshEditorState();
});
```

### Decision: Simple "state-changed" event (no payload)

**Rationale**: For simplicity, emit a bare notification. The frontend re-fetches the full state via `get_editor_state`. This avoids duplicating state structures in event payloads and keeps the contract simple. Can be optimized later with granular events if performance demands.

---

## 5. AppState Structure

### Decision: AppState holds EditorService as Option

**Rationale**: The editor starts empty (no texture open). Using `Option<EditorService>` cleanly represents the "no texture" state. Commands check for `Some` and return a clear error if no texture is open.

```rust
pub struct AppState {
    pub editor: Option<EditorService>,
}
```

**Alternatives considered**:
- `EditorService` always present with a "null object" texture — would require fake dimensions and complicate invariants
- Separate `TextureState` enum — over-engineering for a single-texture app

---

## 6. DTO Strategy

### Decision: Flat DTOs in `commands/` module, manual conversion

**Rationale**: Constitution principle II (Domain Purity) forbids serde derives on domain types. DTOs live in `commands/` (or a `commands/dto.rs` submodule) and implement `From<&DomainType>` for conversion.

### Key DTOs needed

| DTO | Source | Purpose |
|-----|--------|---------|
| `EditorStateDto` | EditorService + Texture | Full state snapshot for frontend |
| `LayerInfoDto` | Layer | Layer metadata (no pixel data) |
| `CompositeDto` | PixelBuffer | Composited RGBA bytes for canvas rendering |
| `ToolResultDto` | ToolResult | Tool operation outcome |
| `TextureMetadataDto` | Texture | Namespace, path, dimensions, dirty flag |

**Pattern:**
```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LayerInfoDto {
    pub id: String,       // LayerId as hex string
    pub name: String,
    pub opacity: f32,
    pub blend_mode: String,
    pub visible: bool,
    pub locked: bool,
}

impl From<&Layer> for LayerInfoDto {
    fn from(layer: &Layer) -> Self { /* ... */ }
}
```
