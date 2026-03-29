# Quickstart: PNG I/O + AppState + Tauri Commands

**Feature Branch**: `005-png-state-commands`

## Prerequisites

- Rust ≥ 1.77, Node.js ≥ 20, pnpm
- Tauri CLI installed (`cargo install tauri-cli`)
- Domain and use_cases layers already implemented (features #2-#4)

## Setup

```bash
# Switch to feature branch
git checkout 005-png-state-commands

# Install frontend deps (adds @tauri-apps/plugin-dialog)
pnpm install

# Verify Rust compiles
cd src-tauri && cargo check && cd ..
```

## New Dependencies

**Rust** (`src-tauri/Cargo.toml`):
```toml
image = { version = "0.25", default-features = false, features = ["png"] }
tauri-plugin-dialog = "2"
```

**Frontend** (`package.json`):
```
@tauri-apps/plugin-dialog
```

## Key Files to Implement

| File | Purpose |
|------|---------|
| `src-tauri/src/state.rs` | `AppState { editor: Option<EditorService> }` |
| `src-tauri/src/error.rs` | `From<DomainError>` and `From<ImageError>` impls |
| `src-tauri/src/infrastructure/png_reader.rs` | `ImageReader` port impl via `image` crate |
| `src-tauri/src/infrastructure/png_writer.rs` | `ImageWriter` port impl via `image` crate |
| `src-tauri/src/commands/dto.rs` | All serde DTOs for IPC |
| `src-tauri/src/commands/texture_commands.rs` | `open_texture`, `save_texture`, `create_texture` |
| `src-tauri/src/commands/tool_commands.rs` | `tool_press`, `tool_drag`, `tool_release` |
| `src-tauri/src/commands/layer_commands.rs` | Layer CRUD and property setters |
| `src-tauri/src/commands/history_commands.rs` | `undo`, `redo` |
| `src-tauri/src/commands/state_commands.rs` | `get_editor_state`, `get_composite` |
| `src-tauri/src/lib.rs` | Register all commands + dialog plugin |
| `src/api/commands.ts` | Typed `invoke()` wrappers |
| `src/store/editorStore.ts` | Zustand store (cache of Rust state) |

## Implementation Order

1. **Infrastructure** — `PngReader`, `PngWriter` (+ tests with PNG fixtures)
2. **State + Error** — Expand `AppState`, add `From` impls for `AppError`
3. **DTOs** — All DTO structs with `From` conversions
4. **Commands** — State queries → texture ops → tool ops → layer ops → history ops
5. **Registration** — Wire everything in `lib.rs` (`generate_handler![]` + plugin)
6. **Frontend wiring** — TypeScript invoke wrappers + Zustand store

## Running Tests

```bash
# Rust tests (domain + infrastructure)
cd src-tauri && cargo test

# Quick check compilation
cargo check
```

## Verification

After implementation, verify with:
1. `cargo test` — all existing + new tests pass
2. `cargo check` — no warnings
3. `pnpm tauri dev` — app launches
4. Open a PNG file via dialog → texture displayed (requires frontend canvas, may be deferred)
5. Undo/redo cycle works end-to-end

## Architecture Notes

- **Commands are thin**: No logic in commands, just lock state → delegate to `EditorService` → convert to DTO → return
- **Domain unchanged**: Zero modifications to `domain/` or `use_cases/`
- **Sync by default**: All commands are sync except `open_texture` and `save_texture` (file I/O)
- **Event after mutation**: Every mutating command emits `"state-changed"` via `app.emit()`
