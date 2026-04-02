# Quickstart: Layers Panel

**Feature**: 010-layers-panel | **Branch**: `010-layers-panel`

## Prerequisites

- Rust >= 1.77, Node.js >= 20
- Run `npm install` to get all dependencies (including @dnd-kit after tasks add it)
- Run `cargo check` in `src-tauri/` to verify Rust compiles

## Dev Workflow

```bash
# Start Tauri dev (Rust backend + Vite frontend)
npm run tauri dev

# Run Rust tests
cd src-tauri && cargo test

# Run frontend tests
npm test

# Type check
npm run typecheck

# Lint
npm run check
```

## Key Files to Know

### Backend (what to modify)

| File | What | Why |
|------|------|-----|
| `src-tauri/src/domain/layer.rs` | Layer struct | Add `duplicate()` method |
| `src-tauri/src/domain/layer_stack.rs` | Layer collection | Add `insert_layer()`, `index_of()` |
| `src-tauri/src/use_cases/editor_service.rs` | Business logic | Add `duplicate_layer()`, `add_layer_above()` |
| `src-tauri/src/commands/dto.rs` | IPC DTOs | Add `thumbnail` to `LayerInfoDto` |
| `src-tauri/src/commands/layer_commands.rs` | Tauri commands | Add `duplicate_layer`, modify `add_layer`, guard `remove_layer` |
| `src-tauri/src/lib.rs` | Command registration | Add `duplicate_layer` to `generate_handler!` |

### Frontend (what to create/modify)

| File | What | Why |
|------|------|-----|
| `src/api/commands.ts` | IPC wrappers | Add `duplicateLayer()`, update `LayerInfoDto` type |
| `src/components/layers/LayersPanel.tsx` | NEW: main panel | Layer list, blend mode, actions |
| `src/components/layers/LayerRow.tsx` | NEW: layer row | Thumbnail, name, visibility, opacity display |
| `src/components/layers/BlendModeSelect.tsx` | NEW: dropdown | Blend mode selector |
| `src/components/panels/LayersPanel.tsx` | Thin wrapper | Delegates to `layers/LayersPanel` |
| `src/store/editorStore.ts` | State store | Already has layers/activeLayerId -- no changes needed |

### Design Reference

| Resource | Location |
|----------|----------|
| UI design | `ui-design` (.pen file, open with Pencil MCP tools) |
| Component | `Panel-Layers` node in the .pen file |
| Theme tokens | `src/styles/theme.ts` -- colors, fonts, fontSizes |

## Architecture Reminders

- **Domain purity**: No serde, tauri, or image imports in `domain/` or `use_cases/`.
- **Thin commands**: Commands lock state, delegate to EditorService, build DTOs, emit events. No business logic.
- **Frontend is a cache**: Zustand stores mirror Rust state. Frontend does NOT own layer data.
- **State sync**: All mutations emit `"state-changed"` -> `editorStore.refreshState()` -> UI re-renders.
- **Undo**: All layer operations automatically record undo entries via EditorService. Frontend just calls `undo()`/`redo()`.

## Testing Strategy

- **Domain**: Unit tests for `Layer::duplicate()`, `LayerStack::insert_layer()`, `LayerStack::index_of()`.
- **Use cases**: Unit tests for `EditorService::duplicate_layer()`, `EditorService::add_layer_above()`.
- **Frontend**: Component tests with mocked `invoke()` for LayersPanel interactions.
