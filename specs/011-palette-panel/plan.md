# Implementation Plan: Palette Panel (create, load, save, switch, scopes)

**Branch**: `011-palette-panel` | **Date**: 2026-04-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-palette-panel/spec.md`

## Summary

Deliver a dockable **Palette** panel that lets users organize colors into named
palettes, switch between them instantly, and paint from them via left/right
click (primary/secondary). Palettes live in two **scopes** — global (shared
across projects) and project (bound to the currently open project) — and can
be **exported/imported** as `.texpal` files for sharing.

**Technical approach**

- **Backend (Rust/Tauri)** — Pure `Palette`/`Swatch` domain entities with a
  `PaletteStore` port. One filesystem adapter, instantiated twice (global
  directory under `app_data_dir()/palettes/`, project directory under
  `<project>/palettes/`). A `PaletteService` use-case orchestrates CRUD,
  uniqueness enforcement, active-palette selection, and JSON import/export.
  Thin Tauri commands wrap the service and emit `state-changed` for MCP
  parity. The active palette per context (global + per-project) is persisted
  in a single `palette-state.json` sidecar under `app_data_dir()`.
- **Frontend (React/TypeScript)** — The existing empty `PalettePanel` becomes
  a self-contained component with a header action bar, a palette dropdown
  (showing scope indicators), and a swatch grid. Left/right click writes to
  the shared `toolStore.activeColor`/`secondaryColor`. Delete targets the
  swatch whose color matches the primary. A **persistent pipette mode** is
  hosted inside the panel — when active, canvas press events are routed to
  append a swatch instead of drawing. State is cached in a new
  `paletteStore` (Zustand) that mirrors Rust state via `state-changed`.
- **File format** — `.texpal` is UTF-8 JSON: `{"version":1,"name":"…",
  "colors":["#RRGGBB",…]}`. Malformed files are rejected with a clear
  validation error; in-memory palettes are never mutated by a failed import.
- **Project-scope bootstrap** — The project subsystem is not yet implemented.
  This feature introduces a minimal `AppState.current_project_path:
  Option<PathBuf>` (initially always `None`) so project-scope commands fail
  gracefully (FR-022). A future project-management feature will set this
  path; no project-management work is in scope here.

## Technical Context

**Language/Version**: Rust ≥ 1.77 (backend), TypeScript ^5.7 (frontend), Node.js ≥ 20 LTS
**Primary Dependencies**: tauri ^2.10, tauri-plugin-dialog ^2, serde ^1, thiserror ^2, uuid ^1 (backend); React ^19.2, @tauri-apps/api ^2.10, @tauri-apps/plugin-dialog ^2.6, zustand ^5, dockview ^5.2, lucide-react ^1.7 (frontend)
**Storage**: Local filesystem — `<app_data_dir>/palettes/*.texpal` (global), `<project>/palettes/*.texpal` (project), `<app_data_dir>/palette-state.json` (active-palette memory per context)
**Testing**: `cargo test` (domain unit tests + in-memory use-case tests + infra fixture tests), `vitest` + `@testing-library/react` + `jsdom` (frontend store + component tests, `invoke()` mocked)
**Target Platform**: Windows, macOS, Linux desktop (Tauri v2 `main` window)
**Project Type**: Desktop application — Tauri v2 (Rust backend + React frontend)
**Performance Goals**: Switching active palette with ≤256 swatches feels instantaneous in user testing (SC-003); malformed file rejection surfaces within 2 s (SC-007). Initial panel render and dropdown rebuild both remain under 100 ms for the realistic upper bound of ~64 palettes × 256 swatches.
**Constraints**: Offline-capable; zero business logic in `commands/`; domain crate graph must remain `std`-only; palette files are UTF-8 JSON; no alpha channel in v1 (opaque `#RRGGBB`); names ≤ 64 chars, unique per scope.
**Scale/Scope**: Realistic usage is a few dozen palettes per scope, each with ≤ 256 swatches. No pagination or virtualization required.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evaluation |
|-----------|--------|------------|
| I. Clean Architecture | ✅ Pass | Layers introduced: `domain/palette.rs` + `domain/ports.rs::PaletteStore`, `use_cases/palette_service.rs`, `infrastructure/palette_store_fs.rs` + `infrastructure/palette_file.rs`, `commands/palette_commands.rs` + `commands/dto.rs` (DTOs). Commands only lock state and delegate. No cross-layer imports. |
| II. Domain Purity | ✅ Pass | `Palette`, `Swatch`, `PaletteScope`, `PaletteName` value objects have zero external deps (std only). Invariants validated at construction (name non-empty, ≤ 64 chars; color is `domain::Color`). No serde derives on domain types — DTOs live in `commands/dto.rs` and `.texpal` codecs live in infrastructure. |
| III. Dual-Access State | ✅ Pass | `PaletteService` is the single source of truth, held in `Mutex<AppState>`. Tauri commands and (future) MCP tool handlers call the same service. Every mutation emits `state-changed` so the frontend `paletteStore` refetches. The frontend never maintains palette data independently from Rust. |
| IV. Test-First Domain | ✅ Pass | Unit tests cover `Palette` (add/remove/dedupe/rename, name validation) and `PaletteService` (CRUD + import/overwrite via an in-memory `PaletteStore` double). Infra tests use temp-dir fixtures for the filesystem adapter. Frontend store tests mock `invoke()`. |
| V. Progressive Processing | ✅ N/A | Feature operates on its own files only; it does not touch texture assets or trigger `.texlab` conversion. |
| VI. Simplicity | ✅ Pass | Palettes are plain JSON with a flat color list. No versioned migrations beyond `version: 1`. Delete/rename flows reuse service-level operations without introducing a command pattern. No premature abstractions (e.g., no palette folders, no search, no multi-format import). Conflict resolution is handled inline in `import_palette`, not via a separate orchestrator. |
| VII. Component-Based UI | ✅ Pass | `PalettePanel` is a self-contained dockview component. The dropdown, swatch grid, and action bar live in the panel body; the header stays minimal. Scope indicators are inline glyphs (global vs. project) rendered with `lucide-react`. No new layout/dock responsibilities introduced. |

**Initial gate**: PASS. No complexity-tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/011-palette-panel/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── commands.md      # Tauri command signatures + error cases
│   └── texpal-schema.json # JSON Schema for .texpal files
└── tasks.md             # Generated later by /speckit.tasks
```

### Source Code (repository root)

```text
src-tauri/src/
├── domain/
│   ├── palette.rs              # NEW — Palette, Swatch, PaletteName, PaletteScope
│   ├── ports.rs                # MODIFIED — add PaletteStore trait
│   ├── color.rs                # REUSED — Color value object
│   └── mod.rs                  # MODIFIED — re-export Palette/Swatch/Scope
├── use_cases/
│   ├── palette_service.rs      # NEW — CRUD + active palette + import/export
│   └── mod.rs                  # MODIFIED — publish PaletteService
├── infrastructure/
│   ├── palette_store_fs.rs     # NEW — filesystem-backed PaletteStore impl
│   ├── palette_file.rs         # NEW — .texpal read/write (JSON codec)
│   ├── palette_state_io.rs     # NEW — palette-state.json read/write
│   └── mod.rs                  # MODIFIED — publish new modules
├── commands/
│   ├── palette_commands.rs     # NEW — list/create/rename/delete/set-active/add-color/remove-color/export/import
│   ├── dto.rs                  # MODIFIED — PaletteDto, SwatchDto, PaletteListDto
│   ├── mod.rs                  # MODIFIED — pub use palette_commands::*
│   └── (other command modules unchanged)
├── state.rs                    # MODIFIED — add palette_service + current_project_path
├── lib.rs                      # MODIFIED — instantiate PaletteService, register palette commands
└── main.rs                     # Unchanged

src-tauri/tests/fixtures/
├── palette_valid.texpal        # NEW — round-trip fixture
├── palette_malformed.texpal    # NEW — parse error fixture
└── palette_wrong_version.texpal # NEW — version guard fixture

src/
├── api/
│   └── commands.ts             # MODIFIED — PaletteDto, palette command wrappers
├── store/
│   ├── paletteStore.ts         # NEW — Zustand cache (palettes, activePaletteId, pipetteActive)
│   └── paletteStore.test.ts    # NEW
├── components/
│   ├── panels/
│   │   └── PalettePanel.tsx    # MODIFIED — full implementation
│   └── palette/                # NEW directory
│       ├── PaletteDropdown.tsx
│       ├── PaletteDropdown.test.tsx
│       ├── SwatchGrid.tsx
│       ├── SwatchGrid.test.tsx
│       ├── PaletteActionBar.tsx
│       ├── NewPaletteDialog.tsx
│       ├── ImportConflictDialog.tsx
│       └── RenamePaletteDialog.tsx
└── commands/definitions/
    └── palette.ts              # NEW — command registrations (e.g., palette.deleteActiveSwatch bound to Delete)
```

**Structure Decision**: Extend the existing TexLab Clean Architecture layout.
Domain types live in `src-tauri/src/domain/palette.rs` with a new
`PaletteStore` port in `domain/ports.rs`; orchestration lives in
`use_cases/palette_service.rs`; I/O lives in `infrastructure/` (split into a
codec module and a store module to keep each ≤ ~120 LOC); Tauri wrappers live
in `commands/palette_commands.rs`; the frontend adds a `palette/` component
directory plus a dedicated `paletteStore`, and registers palette-related
keybindings via the existing command registry.

## Complexity Tracking

> No violations — section intentionally empty.
