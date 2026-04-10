# Implementation Plan: Fix Undo/Redo System

**Branch**: `035-fix-undo-redo` | **Date**: 2026-04-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/035-fix-undo-redo/spec.md`

## Summary

The current undo/redo system captures a full `TextureSnapshot` (all layers, all pixel data) for every operation — draws, property changes, and structural changes alike. This is wasteful and doesn't match the expected granularity described in the spec. Additionally, triggering undo mid-stroke (mouse held down) has no finalization logic, risking state corruption. This plan refactors the snapshot architecture to use targeted payloads (single-layer for draws, metadata-only for property changes, full-stack only for structural changes), adds mid-stroke undo finalization, and ensures stroke boundaries are correct regardless of input speed.

## Technical Context

**Language/Version**: Rust 1.77+ (backend), TypeScript 5.7 (frontend)
**Primary Dependencies**: tauri ^2.10, image ^0.25, React 19, Zustand 5
**Storage**: In-memory (`Mutex<AppState>`), .texlab archives (ZIP) for persistence
**Testing**: `cargo test` (Rust domain + use_cases), vitest planned (frontend)
**Target Platform**: Windows, macOS, Linux (desktop via Tauri)
**Project Type**: Desktop application (Tauri v2)
**Performance Goals**: Undo/redo < 1ms for typical Minecraft textures (16x16 to 64x64)
**Constraints**: Memory proportional to changes, not total texture size * history depth
**Scale/Scope**: Textures 16x16 to 512x512, 1-20 layers, 100-entry history limit

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Clean Architecture | PASS | All changes stay within domain/ and use_cases/. No new infra or framework deps. |
| II. Domain Purity | PASS | New `UndoPayload` enum is pure Rust, no external crates. No serde on domain types. |
| III. Dual-Access State | PASS | Undo/redo operates via `EditorService`; both Tauri commands and MCP call the same code paths. |
| IV. Test-First Domain | PASS | All new undo types and EditorService changes will have unit tests. In-memory only. |
| V. Progressive Processing | N/A | No change to .texlab conversion flow. |
| VI. Simplicity | REVIEW | **Tension**: Constitution says "full-layer snapshots, not diff-based." Spec FR-005/006/007 require targeted capture. Resolution: we still use full-layer snapshots (not pixel diffs), but only for the AFFECTED layer. Property changes use metadata-only payloads. Structural changes (add/remove/reorder) keep full-stack snapshots for simplicity. See research.md for full rationale. |
| VII. Component-Based UI | PASS | No panel layout changes. Frontend only needs to handle mid-stroke undo coordination. |

**Gate result**: PASS (with justified Principle VI refinement for FR-005/006)

### Post-Design Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Clean Architecture | PASS | `UndoPayload`, `PropertyChange` live in `domain/undo.rs`. `EditorService` in `use_cases/`. `history_commands.rs` in `commands/`. No layer violations. |
| II. Domain Purity | PASS | New types use only `LayerId`, `BlendMode`, `f32`, `bool`, `String` — all domain or std. Zero external deps. |
| III. Dual-Access State | PASS | Mid-stroke finalization is in `EditorService::undo()`. Both Tauri commands and MCP call the same method. No divergent code paths. |
| IV. Test-First Domain | PASS | 8 new test scenarios defined in quickstart.md. All exercisable with in-memory `EditorService` and domain types. |
| V. Progressive Processing | N/A | No change to .texlab conversion. |
| VI. Simplicity | PASS | Constitution says "full-layer snapshots, not diff-based." Design preserves this — `SingleLayer` stores the full layer buffer (not pixel diffs). `PropertyChange` avoids snapshotting pixel data for metadata changes. `FullStack` for structural ops keeps the simplest correct approach. 3 code paths, not per-operation-type. |
| VII. Component-Based UI | PASS | No frontend changes needed. Existing error handling covers mid-stroke undo edge case. |

**Gate result**: PASS — all principles satisfied. Principle VI tension resolved per research.md R1.

## Project Structure

### Documentation (this feature)

```text
specs/035-fix-undo-redo/
├── plan.md              # This file
├── research.md          # Phase 0: design decisions and rationale
├── data-model.md        # Phase 1: domain model changes
├── quickstart.md        # Phase 1: dev quickstart
├── contracts/           # Phase 1: IPC contract changes
│   └── tauri-ipc.md     # Undo/redo command contracts
└── tasks.md             # Phase 2 (/speckit.tasks — NOT created here)
```

### Source Code (affected files)

```text
src-tauri/src/
  domain/
    undo.rs              # MAJOR: Replace TextureSnapshot-only with UndoPayload enum
    layer_stack.rs       # MINOR: Add single-layer restore method
  use_cases/
    editor_service.rs    # MAJOR: Targeted snapshots, mid-stroke finalization, new undo/redo logic
  commands/
    history_commands.rs  # MINOR: Mid-stroke finalization in undo command
    tool_commands.rs     # NO CHANGE (stroke lifecycle stays the same)

src/
  commands/
    definitions/edit.ts  # NO CHANGE (keybindings remain the same)
  api/
    commands.ts          # NO CHANGE (undo/redo API signatures unchanged)
```

## Complexity Tracking

| Deviation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Targeted `UndoPayload` vs uniform `TextureSnapshot` | FR-005/006: memory proportional to changes. A property rename shouldn't clone all pixel data. | Full texture snapshots for everything is O(layers * pixels * history). For 5 layers on 64x64 with 100 entries = 40MB. Targeted payloads: ~1MB for same scenario. |
| Full-stack snapshots for structural ops (add/remove/reorder) | Simplicity: inverse command pattern for structural changes adds complexity with asymmetric undo/redo. | Per-FR-007 "capture only structural change + affected data" — but full-stack for structural ops is still simple and correct. These ops are infrequent vs draws. Constitution VI justifies this. |
