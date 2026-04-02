# Implementation Plan: Layers Panel

**Branch**: `010-layers-panel` | **Date**: 2026-04-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-layers-panel/spec.md`

## Summary

Implement a fully interactive "Layers" panel for the TexLab pixel art editor. The panel displays all layers of the active texture with thumbnails, supports CRUD operations (add/delete/duplicate), drag-and-drop reordering, inline rename, visibility toggle, and blend mode selection. All operations synchronize with the Rust backend via Tauri IPC and support undo/redo. The backend already provides most layer commands; the main gaps are `duplicate_layer`, insert-at-position, and thumbnail data in the DTO.

## Technical Context

**Language/Version**: Rust >= 1.77 (backend), TypeScript ^5.7 (frontend)
**Primary Dependencies**: tauri ^2.10, react ^19.2, zustand ^5.0, dockview ^5.2, lucide-react ^1.7, @dnd-kit/core + @dnd-kit/sortable (new)
**Storage**: N/A (in-memory AppState, persisted via .texlab archives in future features)
**Testing**: vitest + @testing-library/react (frontend), cargo test (backend)
**Target Platform**: Windows/macOS/Linux desktop (Tauri v2)
**Project Type**: Desktop application (Tauri v2 -- Rust + React)
**Performance Goals**: Panel responsive with <=50 layers (SC-007), layer operations <500ms (SC-002), visibility toggle instant (SC-004)
**Constraints**: Clean Architecture (domain purity), no serde on domain types, dual-access state (frontend + MCP)
**Scale/Scope**: 1 panel component tree, ~5 new frontend files, ~4 modified backend files, 1 new dependency (@dnd-kit)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Clean Architecture | PASS | `duplicate_layer` follows existing pattern: domain -> use_cases -> commands. Thumbnail data extracted at DTO conversion level (commands layer). |
| II. Domain Purity | PASS | New domain methods (`Layer::duplicate`, `LayerStack::insert_layer`, `LayerStack::index_of`) use zero external deps. No serde on domain types. |
| III. Dual-Access State | PASS | All layer operations go through EditorService, reusable by MCP. "state-changed" event emitted on every mutation. |
| IV. Test-First Domain | PASS | New domain methods (`duplicate`, `insert_layer`, `index_of`) and use case (`duplicate_layer`, `add_layer_above`) will have unit tests. |
| V. Progressive Processing | N/A | Not related to texture conversion. |
| VI. Simplicity | PASS | Thumbnails = raw RGBA in DTO (1KB/layer at 16x16, negligible). @dnd-kit justified by visual feedback requirement (US4-AS2). No virtualization needed for <=50 layers. |
| VII. Component-Based UI | PASS | Self-contained panel with own store subscriptions, follows existing ColorPanel/CanvasViewport pattern. |

**Pre-Phase 0 gate: PASSED**

## Project Structure

### Documentation (this feature)

```text
specs/010-layers-panel/
  plan.md              # This file
  research.md          # Phase 0 output
  data-model.md        # Phase 1 output
  quickstart.md        # Phase 1 output
  contracts/
    ipc.md             # Tauri IPC contracts for layer operations
  tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src-tauri/src/
  domain/
    layer.rs             # MODIFY: add duplicate() method
    layer_stack.rs       # MODIFY: add insert_layer(), index_of()
  use_cases/
    editor_service.rs    # MODIFY: add duplicate_layer(), add_layer_above()
  commands/
    dto.rs               # MODIFY: add thumbnail to LayerInfoDto
    layer_commands.rs    # MODIFY: add duplicate_layer cmd, update add_layer to insert above active
  lib.rs                 # MODIFY: register duplicate_layer in generate_handler!

src/
  api/
    commands.ts          # MODIFY: add duplicateLayer(), update LayerInfoDto type
  components/
    layers/              # NEW: feature module
      LayersPanel.tsx    # Main panel implementation
      LayerRow.tsx       # Single layer row (thumbnail, name, visibility, opacity)
      BlendModeSelect.tsx # Blend mode dropdown component
    panels/
      LayersPanel.tsx    # MODIFY: thin dockview wrapper -> delegates to layers/LayersPanel
  package.json           # MODIFY: add @dnd-kit/core, @dnd-kit/sortable
```

**Structure Decision**: Frontend components live in `components/layers/` as a feature module, consistent with `components/canvas/` and `components/color/`. The existing `panels/LayersPanel.tsx` becomes a thin dockview wrapper (same pattern as `panels/CanvasViewportPanel.tsx`).

## Complexity Tracking

No violations. All decisions align with constitution principles.

## Key Decisions

| Decision | Rationale | See |
|----------|-----------|-----|
| @dnd-kit for drag-and-drop | Lightweight, accessible, purpose-built for sortable lists | [research.md](./research.md#1-drag-and-drop-library) |
| Raw RGBA thumbnails in LayerInfoDto | Simplest for 16x16 textures (~1KB/layer), avoids separate fetch | [research.md](./research.md#2-layer-thumbnail-strategy) |
| No list virtualization | SC-007 requires <=50 layers; no perf concern for a flat list | [research.md](./research.md#3-layer-list-rendering) |
| Custom inline input for rename | Native contentEditable is unreliable; controlled input is simple | [research.md](./research.md#4-inline-rename-pattern) |
