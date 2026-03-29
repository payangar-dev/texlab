# Implementation Plan: PNG I/O + AppState + Tauri Commands

**Branch**: `005-png-state-commands` | **Date**: 2026-03-29 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/005-png-state-commands/spec.md`

## Summary

Wire up the complete backend pipeline from file I/O to Tauri IPC: implement PNG reading/writing via the `image` crate (infrastructure adapters), populate `AppState` with an `EditorService`, create thin Tauri commands for all editing operations (open, save, create, draw, layers, undo/redo, state query), and define DTOs for frontend communication. This connects the already-implemented domain and use case layers to the Tauri frontend.

## Technical Context

**Language/Version**: Rust ≥ 1.77 (backend), TypeScript ^5.7 (frontend)
**Primary Dependencies**: tauri ^2.10, image ^0.25 (new), serde ^1, thiserror ^2, tauri-plugin-dialog ^2 (new), @tauri-apps/plugin-dialog (new)
**Storage**: Local filesystem (PNG files)
**Testing**: cargo test (unit + integration), test fixtures in `src-tauri/tests/fixtures/`
**Target Platform**: Windows, macOS, Linux (cross-platform desktop via Tauri v2)
**Project Type**: Desktop application (Tauri v2)
**Performance Goals**: Open/edit/save cycle < 5 seconds (SC-001), real-time drawing feedback
**Constraints**: Single texture at a time, undo history max 100 entries, PNG-only format
**Scale/Scope**: Textures typically 16x16 to 128x128 (Minecraft), up to 1024x1024

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Clean Architecture | PASS | Infrastructure implements `ImageReader`/`ImageWriter` ports. Commands delegate to `EditorService`. No logic in commands. |
| II | Domain Purity | PASS | Domain unchanged. DTOs with serde live in `commands/`. No serde on domain types. |
| III | Dual-Access State | PASS | `Mutex<AppState>` shared. Commands use `State<'_, Mutex<AppState>>`. Events notify frontend on mutation. |
| IV | Test-First for Domain | PASS | Domain already tested (150+ tests). Infrastructure adapters will have PNG round-trip tests with fixtures. |
| V | Progressive Processing | N/A | This feature opens raw PNG files, not .texlab archives. Progressive conversion is a future concern. |
| VI | Simplicity | PASS | Sync commands for CPU-bound ops. Simple "state-changed" event (no payload). `Option<EditorService>` for empty state. |
| VII | Component-Based UI | N/A | This feature is backend-focused. Frontend receives DTOs and renders — no panel/UI architecture changes. |

**Gate result: PASS** — No violations. Proceeding to design.

## Project Structure

### Documentation (this feature)

```text
specs/005-png-state-commands/
├── plan.md              # This file
├── research.md          # Phase 0 output (completed)
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── tauri-commands.md
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src-tauri/
├── Cargo.toml                      # + image ^0.25, tauri-plugin-dialog ^2
├── src/
│   ├── lib.rs                      # Register commands + dialog plugin
│   ├── error.rs                    # + From<DomainError>, From<ImageError>
│   ├── state.rs                    # AppState { editor, active_tool, active_layer_id }
│   ├── domain/                     # UNCHANGED (already complete)
│   ├── use_cases/                  # UNCHANGED (already complete)
│   ├── infrastructure/
│   │   ├── mod.rs                  # Module declarations
│   │   ├── png_reader.rs           # ImageReader impl (image crate)
│   │   └── png_writer.rs           # ImageWriter impl (image crate)
│   └── commands/
│       ├── mod.rs                  # Re-exports all command functions
│       ├── dto.rs                  # All DTO structs (Serialize, From<Domain>)
│       ├── texture_commands.rs     # open, save, create
│       ├── tool_commands.rs        # tool_press, tool_drag, tool_release
│       ├── layer_commands.rs       # add, remove, reorder, set properties
│       ├── history_commands.rs     # undo, redo
│       └── state_commands.rs       # get_editor_state, get_composite
├── capabilities/
│   └── default.json                # + dialog permissions
└── tests/
    └── fixtures/
        ├── 16x16_rgba.png          # Test PNG with alpha
        ├── 16x16_rgb.png           # Test PNG without alpha (RGB only)
        └── 32x32_transparent.png   # Fully transparent test PNG

src/                                # Frontend (minimal wiring for this feature)
├── api/
│   └── commands.ts                 # Typed invoke() wrappers
└── store/
    └── editorStore.ts              # Zustand store (cache of Rust state)
```

**Structure Decision**: Follows existing Clean Architecture layout. Infrastructure gets 2 new adapter files. Commands get 5 new files organized by concern. DTOs are centralized in `dto.rs` for easy import.

## Complexity Tracking

No constitution violations — this table is empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Post-Design Constitution Re-Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Clean Architecture | PASS | `PngReader`/`PngWriter` implement domain ports. Commands are thin wrappers. DTOs bridge domain ↔ IPC. |
| II | Domain Purity | PASS | Zero changes to domain layer. All serde derives on DTOs only. |
| III | Dual-Access State | PASS | Single `Mutex<AppState>` with `Option<EditorService>`. `app.emit("state-changed", ())` after mutations. |
| IV | Test-First for Domain | PASS | Infrastructure: PNG round-trip tests with fixtures. Commands: can be tested via integration tests or manually. |
| V | Progressive Processing | N/A | Feature opens raw PNGs. No .texlab involved. |
| VI | Simplicity | PASS | No over-abstractions. Flat DTO conversions. Sync commands for CPU, async only for file I/O. |
| VII | Component-Based UI | N/A | Backend-only changes. Frontend wiring is minimal (invoke wrappers + Zustand cache). |

**Post-design gate: PASS**
